const userService = require('../services/userService');
const logger = require('../config/logger');

const userController = {
    // Get current user profile
    async getProfile(req, res) {
        try {
            const userId = req.user.id;
            let profile = await userService.getUserProfile(userId);

            if (!profile) {
                // Create profile if it doesn't exist
                profile = await userService.createUserProfile(req.user);
            }

            res.json({
                success: true,
                data: {
                    profile
                },
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Error fetching user profile', {
                userId: req.user?.id,
                error: error.message,
                stack: error.stack
            });

            res.status(500).json({
                success: false,
                error: {
                    message: 'Failed to fetch user profile',
                    code: 'PROFILE_FETCH_ERROR'
                },
                timestamp: new Date().toISOString()
            });
        }
    },

    // Update user profile
    async updateProfile(req, res) {
        try {
            const userId = req.user.id;
            const updates = req.body;

            // Validate allowed updates
            const allowedFields = ['display_name', 'preferences', 'settings'];
            const filteredUpdates = {};
            
            Object.keys(updates).forEach(key => {
                if (allowedFields.includes(key)) {
                    filteredUpdates[key] = updates[key];
                }
            });

            if (Object.keys(filteredUpdates).length === 0) {
                return res.status(400).json({
                    success: false,
                    error: {
                        message: 'No valid fields to update',
                        code: 'NO_VALID_FIELDS',
                        allowedFields
                    },
                    timestamp: new Date().toISOString()
                });
            }

            const profile = await userService.updateUserProfile(userId, filteredUpdates);

            res.json({
                success: true,
                data: {
                    profile
                },
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Error updating user profile', {
                userId: req.user?.id,
                updates: req.body,
                error: error.message,
                stack: error.stack
            });

            res.status(500).json({
                success: false,
                error: {
                    message: 'Failed to update user profile',
                    code: 'PROFILE_UPDATE_ERROR'
                },
                timestamp: new Date().toISOString()
            });
        }
    },

    // Get user RSS feeds
    async getFeeds(req, res) {
        try {
            const userId = req.user.id;
            const feeds = await userService.getUserFeeds(userId, req.token);

            res.json({
                success: true,
                data: {
                    feeds,
                    count: feeds.length
                },
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Error fetching user feeds', {
                userId: req.user?.id,
                error: error.message,
                stack: error.stack
            });

            res.status(500).json({
                success: false,
                error: {
                    message: 'Failed to fetch RSS feeds',
                    code: 'FEEDS_FETCH_ERROR'
                },
                timestamp: new Date().toISOString()
            });
        }
    },

    // Add new RSS feed
    async addFeed(req, res) {
        try {
            const userId = req.user.id;
            const { rssUrl, customName } = req.body;

            if (!rssUrl) {
                return res.status(400).json({
                    success: false,
                    error: {
                        message: 'RSS URL is required',
                        code: 'MISSING_RSS_URL'
                    },
                    timestamp: new Date().toISOString()
                });
            }

            const feed = await userService.addUserFeed(userId, rssUrl, customName, req.token);

            res.status(201).json({
                success: true,
                data: {
                    feed
                },
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Error adding user feed', {
                userId: req.user?.id,
                rssUrl: req.body?.rssUrl,
                error: error.message,
                stack: error.stack
            });

            const statusCode = error.message.includes('already exists') ? 409 : 500;
            res.status(statusCode).json({
                success: false,
                error: {
                    message: error.message,
                    code: statusCode === 409 ? 'FEED_ALREADY_EXISTS' : 'FEED_ADD_ERROR'
                },
                timestamp: new Date().toISOString()
            });
        }
    },

    // Remove RSS feed
    async removeFeed(req, res) {
        try {
            const userId = req.user.id;
            const { feedId } = req.params;

            if (!feedId) {
                return res.status(400).json({
                    success: false,
                    error: {
                        message: 'Feed ID is required',
                        code: 'MISSING_FEED_ID'
                    },
                    timestamp: new Date().toISOString()
                });
            }

            const feed = await userService.removeUserFeed(userId, feedId, req.token);

            res.json({
                success: true,
                data: {
                    feed,
                    message: 'RSS feed removed successfully'
                },
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Error removing user feed', {
                userId: req.user?.id,
                feedId: req.params?.feedId,
                error: error.message,
                stack: error.stack
            });

            // Handle specific error cases
            if (error.message.includes('not found')) {
                return res.status(404).json({
                    success: false,
                    error: {
                        message: 'RSS feed not found',
                        code: 'FEED_NOT_FOUND'
                    },
                    timestamp: new Date().toISOString()
                });
            }

            res.status(500).json({
                success: false,
                error: {
                    message: 'Failed to remove RSS feed',
                    code: 'FEED_REMOVE_ERROR'
                },
                timestamp: new Date().toISOString()
            });
        }
    },

    // Get reading history
    async getReadingHistory(req, res) {
        try {
            const userId = req.user.id;
            const limit = parseInt(req.query.limit) || 50;

            const history = await userService.getReadingHistory(userId, limit);

            res.json({
                success: true,
                data: {
                    history,
                    count: history.length
                },
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Error fetching reading history', {
                userId: req.user?.id,
                limit: req.query?.limit,
                error: error.message,
                stack: error.stack
            });

            res.status(500).json({
                success: false,
                error: {
                    message: 'Failed to fetch reading history',
                    code: 'HISTORY_FETCH_ERROR'
                },
                timestamp: new Date().toISOString()
            });
        }
    },

    // Mark article as read
    async markAsRead(req, res) {
        try {
            const userId = req.user.id;
            const { articleUrl, liked = false } = req.body;

            if (!articleUrl) {
                return res.status(400).json({
                    success: false,
                    error: {
                        message: 'Article URL is required',
                        code: 'MISSING_ARTICLE_URL'
                    },
                    timestamp: new Date().toISOString()
                });
            }

            const historyEntry = await userService.addToReadingHistory(userId, articleUrl, liked);

            res.json({
                success: true,
                data: {
                    historyEntry
                },
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Error marking article as read', {
                userId: req.user?.id,
                articleUrl: req.body?.articleUrl,
                error: error.message,
                stack: error.stack
            });

            res.status(500).json({
                success: false,
                error: {
                    message: 'Failed to mark article as read',
                    code: 'MARK_READ_ERROR'
                },
                timestamp: new Date().toISOString()
            });
        }
    },

    // Get user summaries
    async getSummaries(req, res) {
        try {
            const userId = req.user.id;
            const limit = parseInt(req.query.limit) || 20;

            const summaries = await userService.getUserSummaries(userId, limit);

            res.json({
                success: true,
                data: {
                    summaries,
                    count: summaries.length
                },
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Error fetching user summaries', {
                userId: req.user?.id,
                limit: req.query?.limit,
                error: error.message,
                stack: error.stack
            });

            res.status(500).json({
                success: false,
                error: {
                    message: 'Failed to fetch summaries',
                    code: 'SUMMARIES_FETCH_ERROR'
                },
                timestamp: new Date().toISOString()
            });
        }
    },

    // Delete user account and data
    async deleteAccount(req, res) {
        try {
            const userId = req.user.id;
            
            // Delete user data from our database
            await userService.deleteUserData(userId);

            // Note: Supabase user deletion should be handled separately
            // using the admin API or through the user's auth client
            
            res.json({
                success: true,
                data: {
                    message: 'User data deleted successfully'
                },
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Error deleting user account', {
                userId: req.user?.id,
                error: error.message,
                stack: error.stack
            });

            res.status(500).json({
                success: false,
                error: {
                    message: 'Failed to delete user account',
                    code: 'ACCOUNT_DELETE_ERROR'
                },
                timestamp: new Date().toISOString()
            });
        }
    },

    // Get user dashboard data
    async getDashboard(req, res) {
        try {
            const userId = req.user.id;

            // Get profile, feeds, recent history, and summaries in parallel
            const [profile, feeds, recentHistory, recentSummaries] = await Promise.all([
                userService.getUserProfile(userId),
                userService.getUserFeeds(userId),
                userService.getReadingHistory(userId, 10),
                userService.getUserSummaries(userId, 5)
            ]);

            const dashboardData = {
                profile,
                feeds: {
                    items: feeds,
                    count: feeds.length
                },
                recentActivity: {
                    history: recentHistory,
                    summaries: recentSummaries
                },
                stats: {
                    totalFeeds: feeds.length,
                    totalRead: recentHistory.length,
                    totalSummaries: recentSummaries.length
                }
            };

            res.json({
                success: true,
                data: dashboardData,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Error fetching dashboard data', {
                userId: req.user?.id,
                error: error.message,
                stack: error.stack
            });

            res.status(500).json({
                success: false,
                error: {
                    message: 'Failed to fetch dashboard data',
                    code: 'DASHBOARD_FETCH_ERROR'
                },
                timestamp: new Date().toISOString()
            });
        }
    }
};

module.exports = userController;