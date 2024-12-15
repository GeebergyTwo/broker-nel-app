const mongoose = require('mongoose');
      
const schema = new mongoose.Schema({
    avatar: String,
    number: String,
    role: String,
    balance: Number,
    deposit: Number,
    referralsBalance : Number,
    referralCode : String,
    agentID: String,
    agentCode: String,
    isOwner: Boolean,
    referredUsers : Number,
    referredBy: String,
    referralRedeemed: Boolean,
    isUserActive: Boolean,
    hasPaid: Boolean,
    name: String,
    email: String,
    lastLogin: Date,
    userId: { type: String, required: true, unique: true },
    firstLogin: { type: Boolean, default: true },
    currencySymbol: String,
    country: String,
    returns: Number,
  });

 
  const User = mongoose.model('User', schema);
  module.exports = User;
