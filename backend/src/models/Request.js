import mongoose from 'mongoose';

const requestSchema = new mongoose.Schema(
  {
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      required: true,
    },
    borrower: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    lender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: [
        'pending',
        'approved',
        'rejected',
        'payment_pending',
        'paid',
        'handover_pending',
        'borrowed',
        'return_pending',
        'returned',
        'cancelled',
      ],
      default: 'pending',
    },
    duration: {
      type: Number,
      required: [true, 'Please specify borrowing duration in days'],
      min: [1, 'Duration must be at least 1 day'],
    },
    securityDepositPaid: {
      type: Boolean,
      default: false,
    },
    rentalFeePaid: {
      type: Boolean,
      default: false,
    },
    handoverCode: {
      type: String,
    },
    returnCode: {
      type: String,
    },
    dueDate: {
      type: Date,
    },
    actualReturnDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

const Request = mongoose.model('Request', requestSchema);

export default Request;
