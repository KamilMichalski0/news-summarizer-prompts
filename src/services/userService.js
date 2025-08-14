const { createClient } = require('@supabase/supabase-js');
const config = require('../config/env');
const logger = require('../config/logger');

// Default supabase client for backwards compatibility  
const { supabase } = require('../middleware/auth');

class UserService {
    // Create authenticated Supabase client for user operations
    createUserClient(userToken) {
        const client = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
            global: {
                headers: {
                    Authorization: `Bearer ${userToken}`
                }
            }
        });
        return client;
    }
    async createUserProfile(user, additionalData = {}) {
        try {
            const profileData = {
                user_id: user.id,
                email: user.email,
                display_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
                avatar_url: user.user_metadata?.avatar_url || null,
                preferences: {
                    language: 'pl',
                    max_articles: 6,
                    auto_translate: true,
                    auto_summarize: true,
                    ...additionalData.preferences
                },
                settings: {
                    theme: 'light',
                    notifications: true,
                    ...additionalData.settings
                },
                created_at: new Date().toISOString()
            };

            const { data, error } = await supabase
                .from('profiles')
                .insert([profileData])
                .select()
                .single();

            if (error) {
                if (error.code === '23505') { // Unique constraint violation
                    logger.info('User profile already exists', { userId: user.id });
                    return await this.getUserProfile(user.id);
                }
                throw error;
            }

            logger.info('User profile created', { userId: user.id, profileId: data.id });
            return data;
        } catch (error) {
            logger.error('Error creating user profile', {
                userId: user.id,
                error: error.message,
                stack: error.stack
            });
            throw new Error('Failed to create user profile');
        }
    }

    async getUserProfile(userId) {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') { // No rows returned
                    return null;
                }
                throw error;
            }

            return data;
        } catch (error) {
            logger.error('Error fetching user profile', {
                userId,
                error: error.message,
                stack: error.stack
            });
            throw new Error('Failed to fetch user profile');
        }
    }

    async updateUserProfile(userId, updates) {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .update({
                    ...updates,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', userId)
                .select()
                .single();

            if (error) {
                throw error;
            }

            logger.info('User profile updated', { userId, updates: Object.keys(updates) });
            return data;
        } catch (error) {
            logger.error('Error updating user profile', {
                userId,
                updates,
                error: error.message,
                stack: error.stack
            });
            throw new Error('Failed to update user profile');
        }
    }

    async getUserFeeds(userId, userToken = null) {
        try {
            logger.info('Getting user feeds', { userId, hasToken: !!userToken });
            
            // Use authenticated client if token provided
            const client = userToken ? this.createUserClient(userToken) : supabase;
            const { data, error } = await client
                .from('user_feeds')
                .select('*')
                .eq('user_id', userId)
                .eq('active', true)
                .order('created_at', { ascending: false });

            if (error) {
                logger.error('Database error getting user feeds', { userId, error: error.message });
                throw error;
            }

            logger.info('User feeds retrieved', { userId, count: data ? data.length : 0, data });
            return data || [];
        } catch (error) {
            logger.error('Error fetching user feeds', {
                userId,
                error: error.message,
                stack: error.stack
            });
            throw new Error('Failed to fetch user feeds');
        }
    }

    async addUserFeed(userId, rssUrl, customName = null, userToken = null) {
        try {
            const feedData = {
                user_id: userId,
                rss_url: rssUrl,
                custom_name: customName || new URL(rssUrl).hostname,
                active: true,
                created_at: new Date().toISOString()
            };

            // Use authenticated client if token provided, otherwise use default
            const client = userToken ? this.createUserClient(userToken) : supabase;
            const { data, error } = await client
                .from('user_feeds')
                .insert([feedData])
                .select()
                .single();

            if (error) {
                if (error.code === '23505') { // Unique constraint violation
                    throw new Error('RSS feed already exists for this user');
                }
                throw error;
            }

            logger.info('User feed added', { userId, rssUrl, feedId: data.id });
            return data;
        } catch (error) {
            logger.error('Error adding user feed', {
                userId,
                rssUrl,
                customName,
                error: error.message,
                stack: error.stack
            });
            
            if (error.message.includes('already exists')) {
                throw error;
            }
            throw new Error('Failed to add RSS feed');
        }
    }

    async removeUserFeed(userId, feedId, userToken = null) {
        try {
            // Use authenticated client if token provided (for RLS)
            const client = userToken ? this.createUserClient(userToken) : supabase;
            
            // First check if the feed exists and belongs to the user
            const { data: existingFeed, error: checkError } = await client
                .from('user_feeds')
                .select('id, active')
                .eq('user_id', userId)
                .eq('id', feedId)
                .single();

            if (checkError) {
                if (checkError.code === 'PGRST116') { // No rows returned
                    throw new Error('RSS feed not found or does not belong to this user');
                }
                throw checkError;
            }

            if (!existingFeed.active) {
                logger.info('Feed already inactive', { userId, feedId });
                return existingFeed;
            }

            // Update the feed to inactive
            const { data, error } = await client
                .from('user_feeds')
                .update({ active: false })
                .eq('user_id', userId)
                .eq('id', feedId)
                .select()
                .single();

            if (error) {
                throw error;
            }

            logger.info('User feed removed', { userId, feedId });
            return data;
        } catch (error) {
            logger.error('Error removing user feed', {
                userId,
                feedId,
                error: error.message,
                stack: error.stack
            });
            
            if (error.message.includes('not found')) {
                throw error;
            }
            throw new Error('Failed to remove RSS feed');
        }
    }

    async addToReadingHistory(userId, articleUrl, liked = false) {
        try {
            const historyData = {
                user_id: userId,
                article_url: articleUrl,
                read_at: new Date().toISOString(),
                liked: liked
            };

            const { data, error } = await supabase
                .from('reading_history')
                .insert([historyData])
                .select()
                .single();

            if (error) {
                if (error.code === '23505') { // Already read
                    // Update existing record
                    return await this.updateReadingHistory(userId, articleUrl, { liked });
                }
                throw error;
            }

            return data;
        } catch (error) {
            logger.error('Error adding to reading history', {
                userId,
                articleUrl,
                error: error.message,
                stack: error.stack
            });
            throw new Error('Failed to add to reading history');
        }
    }

    async updateReadingHistory(userId, articleUrl, updates) {
        try {
            const { data, error } = await supabase
                .from('reading_history')
                .update({
                    ...updates,
                    read_at: new Date().toISOString()
                })
                .eq('user_id', userId)
                .eq('article_url', articleUrl)
                .select()
                .single();

            if (error) {
                throw error;
            }

            return data;
        } catch (error) {
            logger.error('Error updating reading history', {
                userId,
                articleUrl,
                updates,
                error: error.message,
                stack: error.stack
            });
            throw new Error('Failed to update reading history');
        }
    }

    async getReadingHistory(userId, limit = 50) {
        try {
            const { data, error } = await supabase
                .from('reading_history')
                .select('*')
                .eq('user_id', userId)
                .order('read_at', { ascending: false })
                .limit(limit);

            if (error) {
                // Check if it's a table not found error
                if (error.message.includes('schema cache') || error.message.includes('not found')) {
                    logger.warn('Reading history table not found, returning empty data', { userId });
                    return [];
                }
                throw error;
            }

            return data || [];
        } catch (error) {
            // If table doesn't exist, return empty array instead of failing
            if (error.message.includes('schema cache') || error.message.includes('not found')) {
                logger.warn('Reading history table not found, returning empty data', { userId });
                return [];
            }
            
            logger.error('Error fetching reading history', {
                userId,
                limit,
                error: error.message,
                stack: error.stack
            });
            throw new Error('Failed to fetch reading history');
        }
    }

    async saveSummary(userId, articleId, summary, articleData = {}) {
        try {
            const summaryData = {
                user_id: userId,
                article_id: articleId,
                summary: summary,
                article_title: articleData.title || null,
                article_url: articleData.url || null,
                created_at: new Date().toISOString()
            };

            const { data, error } = await supabase
                .from('user_summaries')
                .insert([summaryData])
                .select()
                .single();

            if (error) {
                throw error;
            }

            logger.info('Summary saved', { userId, articleId, summaryId: data.id });
            return data;
        } catch (error) {
            logger.error('Error saving summary', {
                userId,
                articleId,
                error: error.message,
                stack: error.stack
            });
            throw new Error('Failed to save summary');
        }
    }

    async getUserSummaries(userId, limit = 20) {
        try {
            const { data, error } = await supabase
                .from('user_summaries')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) {
                // Check if it's a table not found error
                if (error.message.includes('schema cache') || error.message.includes('not found')) {
                    logger.warn('User summaries table not found, returning empty data', { userId });
                    return [];
                }
                throw error;
            }

            return data || [];
        } catch (error) {
            // If table doesn't exist, return empty array instead of failing
            if (error.message.includes('schema cache') || error.message.includes('not found')) {
                logger.warn('User summaries table not found, returning empty data', { userId });
                return [];
            }
            
            logger.error('Error fetching user summaries', {
                userId,
                limit,
                error: error.message,
                stack: error.stack
            });
            throw new Error('Failed to fetch user summaries');
        }
    }

    async deleteUserData(userId) {
        try {
            // Delete in order to avoid foreign key constraints
            const tables = ['user_summaries', 'reading_history', 'user_feeds', 'profiles'];
            
            for (const table of tables) {
                const { error } = await supabase
                    .from(table)
                    .delete()
                    .eq('user_id', userId);
                
                if (error) {
                    logger.error(`Error deleting from ${table}`, { userId, error: error.message });
                }
            }

            logger.info('User data deleted', { userId });
            return true;
        } catch (error) {
            logger.error('Error deleting user data', {
                userId,
                error: error.message,
                stack: error.stack
            });
            throw new Error('Failed to delete user data');
        }
    }
}

module.exports = new UserService();