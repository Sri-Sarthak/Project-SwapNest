import Request from '../models/Request.js';
import Transaction from '../models/Transaction.js';
import Item from '../models/Item.js';
import User from '../models/User.js';

// @desc    Get dashboard analytics data
// @route   GET /api/analytics/dashboard
// @access  Private
export const getDashboardAnalytics = async (req, res, next) => {
  try {
    // 1. Most Borrowed Items
    const mostBorrowedItems = await Request.aggregate([
      {
        $match: {
          status: { $in: ['borrowed', 'return_pending', 'returned'] },
        },
      },
      {
        $group: {
          _id: '$item',
          borrowCount: { $sum: 1 },
        },
      },
      {
        $sort: { borrowCount: -1 },
      },
      {
        $limit: 5,
      },
      {
        $lookup: {
          from: 'items',
          localField: '_id',
          foreignField: '_id',
          as: 'itemInfo',
        },
      },
      {
        $unwind: '$itemInfo',
      },
      {
        $project: {
          _id: 1,
          borrowCount: 1,
          title: '$itemInfo.title',
          category: '$itemInfo.category',
          images: '$itemInfo.images',
        },
      },
    ]);

    // 2. Most Active Lenders
    const mostActiveLenders = await Request.aggregate([
      {
        $match: {
          status: { $in: ['borrowed', 'return_pending', 'returned'] },
        },
      },
      {
        $group: {
          _id: '$lender',
          lendCount: { $sum: 1 },
        },
      },
      {
        $sort: { lendCount: -1 },
      },
      {
        $limit: 5,
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'lenderInfo',
        },
      },
      {
        $unwind: '$lenderInfo',
      },
      {
        $project: {
          _id: 1,
          lendCount: 1,
          name: '$lenderInfo.name',
          avatar: '$lenderInfo.avatar',
          trustScore: '$lenderInfo.trustScore',
          department: '$lenderInfo.department',
        },
      },
    ]);

    // 3. Department-wise Lending / Borrowing stats
    const departmentStats = await Request.aggregate([
      {
        $match: {
          status: { $in: ['borrowed', 'return_pending', 'returned'] },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'borrower',
          foreignField: '_id',
          as: 'borrowerInfo',
        },
      },
      {
        $unwind: '$borrowerInfo',
      },
      {
        $group: {
          _id: '$borrowerInfo.department',
          borrowCount: { $sum: 1 },
        },
      },
      {
        $sort: { borrowCount: -1 },
      },
    ]);

    // 4. Monthly Transaction values and volumes
    const monthlyTransactions = await Transaction.aggregate([
      {
        $match: {
          status: 'success',
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      {
        $sort: {
          '_id.year': 1,
          '_id.month': 1,
        },
      },
      {
        $limit: 12, // Show last 12 months
      },
    ]);

    // 5. Global Stats
    const totalListedItems = await Item.countDocuments();
    const totalTransactions = await Transaction.countDocuments({ status: 'success' });
    const totalUsers = await User.countDocuments();
    const activeRequests = await Request.countDocuments({
      status: { $in: ['pending', 'approved', 'payment_pending', 'paid', 'handover_pending', 'borrowed'] },
    });

    res.status(200).json({
      success: true,
      stats: {
        totalListedItems,
        totalTransactions,
        totalUsers,
        activeRequests,
      },
      mostBorrowedItems,
      mostActiveLenders,
      departmentStats,
      monthlyTransactions,
    });
  } catch (error) {
    next(error);
  }
};
