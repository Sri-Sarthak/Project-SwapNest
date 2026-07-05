import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please add an email'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please add a valid email address',
      ],
    },
    password: {
      type: String,
      required: function () {
        // Only require password if googleId is not present
        return !this.googleId;
      },
      minlength: [6, 'Password must be at least 6 characters long'],
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true, // Allows multiple users with no googleId (null)
    },
    avatar: {
      type: String,
      default: '',
    },
    department: {
      type: String,
      default: 'General',
    },
    semester: {
      type: Number,
      default: 1,
      min: [1, 'Semester must be at least 1'],
      max: [8, 'Semester cannot exceed 8'],
    },
    trustScore: {
      type: Number,
      default: 100,
      min: 0,
      max: 100,
    },
    sharePoints: {
      type: Number,
      default: 200, // Starting utility points
    },
    verified: {
      type: Boolean,
      default: false,
    },
    verificationToken: String,
    resetPasswordToken: String,
    resetPasswordExpire: Date,
  },
  {
    timestamps: true,
  }
);

// Encrypt password using bcrypt before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

export default User;
