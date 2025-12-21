import mongoose from 'mongoose';

const TransactionSchema = new mongoose.Schema({
  source: Number,
  target: Number,
  amount: Number,
  timestamp: { type: Date, default: Date.now }
});

export default mongoose.models.Transaction || mongoose.model('Transaction', TransactionSchema);