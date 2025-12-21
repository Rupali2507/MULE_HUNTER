import mongoose from 'mongoose';

const NodeSchema = new mongoose.Schema({
  node_id: { type: Number, unique: true, required: true },
  account_age_days: Number,
  balance: Number,
  in_out_ratio: Number,
  pagerank: Number,
  tx_velocity: Number,
  in_degree: Number,
  out_degree: Number,
  total_incoming: Number,
  total_outgoing: Number,
  risk_ratio: Number,
  // These will be updated dynamically via WebSocket later
  is_anomalous: { type: Number, default: 0 }, 
  reasons: [String], // From fraud_explanations.json
  shap_factors: [{ feature: String, impact: Number }] // From shap_explanations.json
});

export default mongoose.models.Node || mongoose.model('Node', NodeSchema);