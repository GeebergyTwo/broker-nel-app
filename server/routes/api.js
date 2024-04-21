// my-app/server/routes/api.js
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const User = require('../model');
const { MongoClient } = require('mongodb');
const cron = require('node-cron');
const axios = require('axios');

const uri = "mongodb+srv://TheGilo:OnlyOneGilo@cluster1.pvwjh.mongodb.net/userData?retryWrites=true&w=majority&appName=DripDashCluster";

async function connectToMongoDB() {
  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');
  } catch (error) {

    
    console.error('Error connecting to MongoDB', error);
  }
}

connectToMongoDB();



// create user
router.post("/createUser", async (request, response) => {
  const userDetails = new User(request.body);
  const userId = userDetails.userId;
 
  try {
    const doesDataExist = await User.findOne({ userId: userId});
    if(!doesDataExist){
      await userDetails.save();
      response.send({"userDetails": userDetails, "status": "success"});
    }
    else{
      const reply = {
        "status": "failed",
        "message": "User data already exists",
      }
      response.send(reply);
    }
    
  } catch (error) {
    response.status(500).send(error);
  }
});

router.post("/addUser", async (request, response) => {
  const userDetails = new User(request.body);
  const userId = userDetails.userId;
 
  try {
    const doesDataExist = await User.findOne({ userId: userId});
    if(!doesDataExist){
      await userDetails.save();
      response.send({"userDetails": userDetails, "status": "success"});
    }
    else{
      const reply = {
        "status": "success",
        "message": "User data already exists",
      }
      response.send(reply);
    }
    
  } catch (error) {
    response.status(500).send(error);
  }
});
// update users on referrals change

// define crypto save collection
// Define schema for storing payment callback data
const PaymentCallbackSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now }, // Timestamp of the callback
  userID: String,
  payment_id: String,
  payment_status: String,
  pay_address: String,
  price_amount: Number,
  order_description: String
});

// Create model for payment callback data
const PaymentCallback = mongoose.model('PaymentCallback', PaymentCallbackSchema, 'cryptopayment');

// save data
// Define a route to handle transaction creation
router.post('/saveCryptoPayments', async (request, response) => {
  try {
    const paymentData = request.body;
    const paymentCallback = new PaymentCallback(paymentData);

    // Save the document to the database
    paymentCallback.save()
      .then(() => {
        console.log('Payment callback data saved successfully');
        response.sendStatus(200); // Respond with success status
      })
      .catch(error => {
        console.error('Error saving payment callback data:', error);
        response.status(500).send('Error saving payment callback data'); // Respond with error status
      });
  } catch (error) {
    console.error('Error adding transaction document: ', error);
    response.status(500).json({ error: 'Internal Server Error' });
  }
});

// ...
// callback data
router.post('/payment', async (req, res) => {
  try {
    const { data } = req.body;
    const API_KEY = 'ANAVJWM-2GKMRZJ-GV6RDW4-J1N753D';

    const response = await axios.post('https://api.nowpayments.io/v1/payment', data, {
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
      }
    });

  res.json(response.data);
  } catch (error) {
    console.error('Error proxying request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// Callback endpoint (crypto)

router.post('/crypto-callback', async (req, res) => {
  try {
    const { data } = req.body;

    res.json(data);
    console.log(data);
  } catch (error) {
    console.error('Error proxying request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// 
// Backend (Express) - Route to Add Participants
router.post('/addParticipant', async (req, res) => {
  try {
      const { userId, fee } = req.body;
      // update user balance before adding them
      await User.findOneAndUpdate(
        { userId: userId },
        { $inc: { referralsBalance: -fee, slots: 1 } }, // Deduct the fee from the balance
        { new: true } // To return the updated user document
      );
  
      // Check if the user exists and the balance was updated
      
       // Save participant to the "raffleParticipants" collection in MongoDB
       await RaffleParticipant.create({ userId, category: 'participant' });
       res.status(200).json({ message: 'Fee deducted successfully'});
      
  } catch (error) {
      console.error('Error adding participant:', error);
      res.status(500).json({ error: 'Internal Server Error' });
  }
});



// update account limit
router.post('/updateAccountLimit', async (req, res) => {
  const userId = req.body.userId;

  try {
    const userDoc = await User.findOne({ userId: userId });

    // Get the referredBy user's ID from the current user's document
    const referredByUserId = userDoc.referredBy;

    if (referredByUserId !== 'none') {
      try {
        // Fetch the referredBy user's document
        const referredByUserDoc = await User.findOne({ userId: referredByUserId });

        if (!referredByUserDoc) {
          throw new Error('ReferredBy user data not found.');
        }

        // Define account limit, activity, and referral count from the referredBy user
        const currentAccountLimit = referredByUserDoc.accountLimit;
        const isAccountActive = referredByUserDoc.isUserActive;
        const referralsCount = referredByUserDoc.referralsCount;
        const hasUserPaid = referredByUserDoc.hasPaid;

        const amount = referredByUserDoc.reserveAccountLimit;

        // Check if the user has three referrals and isAccountActive
        if (referralsCount >= 3 && isAccountActive && hasUserPaid) {
          await User.updateOne(
            { userId: referredByUserId },
            { $set: { accountLimit: parseFloat(currentAccountLimit) + parseFloat(amount), referralsCount: 0, hasPaid: false } }
          );
        }

        // Fetch the referredBy user's balance after potential update
        const updatedAccountLimitDoc = await User.findOne({ userId: referredByUserId });

        try {
          // Fetch the user's document
          const currentUserDoc = await User.findOne({ userId: userId });
  
          if (!currentUserDoc) {
            throw new Error('User data not found.');
          }
  
          const currentUserAccountLimit = currentUserDoc.accountLimit;
          const isCurrentAccountActive = currentUserDoc.isUserActive;
          const currentUserReferralsCount = currentUserDoc.referralsCount;
          const currentUserPaid = currentUserDoc.hasPaid;
  
          const amount = currentUserDoc.reserveAccountLimit;
  
          // Check if the user has three referrals and isCurrentAccountActive
          if (currentUserReferralsCount >= 3 && isCurrentAccountActive && currentUserPaid) {
            await User.updateOne(
              { userId: userId },
              { $set: { accountLimit: parseFloat(currentUserAccountLimit) + parseFloat(amount), referralsCount: 0, hasPaid: false } }
            );
          }
  
        } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Internal Server Error' });
        }

        if (!updatedAccountLimitDoc) {
          throw new Error('ReferredBy user data not found after update.');
        }

      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    } else {
      try {
        // Fetch the user's document
        const currentUserDoc = await User.findOne({ userId: userId });

        if (!currentUserDoc) {
          throw new Error('User data not found.');
        }

        const currentUserAccountLimit = currentUserDoc.accountLimit;
        const isCurrentAccountActive = currentUserDoc.isUserActive;
        const currentUserReferralsCount = currentUserDoc.referralsCount;
        const currentUserPaid = currentUserDoc.hasPaid;

        const amount = currentUserDoc.reserveAccountLimit;

        // Check if the user has three referrals and isCurrentAccountActive
        if (currentUserReferralsCount >= 3 && isCurrentAccountActive && currentUserPaid) {
          await User.updateOne(
            { userId: userId },
            { $set: { accountLimit: parseFloat(currentUserAccountLimit) + parseFloat(amount), referralsCount: 0, hasPaid: false } }
          );
        }

      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    }

    res.status(200).json({ message: 'Account limit updated successfully' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
// update user data
router.post("/updateInfo", async (request, response) => {
  const userDetails = new User(request.body);
  const userId = userDetails.userId;
 
  try {
    const doesDataExist = await User.findOne({ userId: userId});
    try {
      // Example 1: Updating user's balance
      // await User.updateOne(
      //   { userId: userId },
      //   { $set: { balance: newBalance } }
      // );
      
      // Example 2: Incrementing referredUsers field
      if(doesDataExist){
        await User.updateOne(
          { userId: userId },
          { $inc: { referredUsers: 1, weeklyReferrals: 1 } }
      );
      
    
        response.send({"status": "successful", "referrerData" : doesDataExist})
      }
      else{

      }
      
    } catch (error) {
      response.send(error);
    }
    
  } catch (error) {
    response.status(500).send(error);
  }
});

// update user balance
router.post("/updateBalance", async (request, response) => {
  const userDetails = new User(request.body);
  const userId = userDetails.userId;
  const newBalance = userDetails.balance;
  const dailyDropBalance = userDetails.dailyDropBalance;
  const accountLimit = userDetails.accountLimit;
  const lastLogin = userDetails.lastLogin;
  const firstLogin = userDetails.firstLogin;
  const weeklyEarnings = userDetails.weeklyEarnings;
 
  try {
    const doesDataExist = await User.findOne({ userId: userId});
    try {
      // Example 1: Updating user's balance
      
  
      // Example 2: Incrementing referredUsers field
      if(doesDataExist){
        await User.updateOne(
          { userId: userId },
          { $set: { balance: newBalance,
          dailyDropBalance,
          accountLimit,
          lastLogin,
          firstLogin },
          $inc: { weeklyEarnings: weeklyEarnings}  },
           
        );
    
        response.send({"status": "successful", "referrerData" : doesDataExist})
      }
      else{
        response.send({"status": "failed",})
      }
      
    } catch (error) {
      response.send(error);
    }
    
  } catch (error) {
    response.status(500).send(error);
  }
});

// UPDATE INFO AFTER PAY
// update user data
router.post("/updateInfoAfterPay", async (request, response) => {
  const userDetails = new User(request.body);
  const userId = userDetails.userId;
  const deposit = userDetails.deposit;
  const dailyDropBalance = userDetails.dailyDropBalance;
  const referralsBalance = userDetails.referralsBalance;
  const addAmount = userDetails.addAmount;
  const amountToAdd = userDetails.amountToAdd;
 
  try {
    const doesDataExist = await User.findOne({ userId: userId});
    try {
  
        if(doesDataExist){
          await User.updateOne(
            { userId: userId },
            { $set: { deposit,
              isUserActive: true,
              dailyDropBalance,
              referralRedeemed: true,
              referralsBalance,
              hasPaid: true },
              $inc: { weeklyEarnings: referralsBalance } }
          );
          response.send({"status": "successful", "referrerData" : doesDataExist})
      }
      else{
        response.send({"status": "failed",})
      }
     
      
      
    } catch (error) {
      response.send(error);
    }
    
  } catch (error) {
    response.status(500).send(error);
  }
});

// UPDATE BALANCE AFTER TASK

// 


//DEBIT USER AFTER WITHDRAWAL
// updating user details after withdrawal
// update user data
router.post("/updateOnDebit", async (request, response) => {
  const userDetails = new User(request.body);
  const userId = userDetails.userId;
  const adRevenue = userDetails.adRevenue;
  const referralsBalance = userDetails.referralsBalance;
  const dailyDropBalance = userDetails.dailyDropBalance;
  const accountLimit = userDetails.accountLimit;
 
  try {
    const doesDataExist = await User.findOne({ userId: userId});
    try {
   
  
      // Example 2: Incrementing referredUsers field
      if(doesDataExist){
          await User.updateOne(
            { userId: userId },
            { $set: { adRevenue,
              referralsBalance,
              dailyDropBalance,
              accountLimit},
              $inc: { weeklyEarnings: referralsBalance } }
          );
        
    
        response.send({"status": "successful", "referrerData" : doesDataExist})
      }
      else{
        response.send({"status": "failed",})
      }
      
    } catch (error) {
      response.send(error);
    }
    
  } catch (error) {
    response.status(500).send(error);
  }
});

// CREDIT REFERRER AFTER PAY
router.post("/creditReferrer", async (request, response) => {
  const userDetails = request.body;
  const userId = userDetails.userId;
  const referralsCount = userDetails.referralsCount;
  const totalReferrals = userDetails.totalReferrals;
  const balance = userDetails.balance;
  const referralsBalance = userDetails.referralsBalance;

  try {
    const referredByUser = await User.findOne({ userId: userId });
    const referredByUserRole = referredByUser ? referredByUser.role : null;
    const referredByUserTotalReferrals = referredByUser ? referredByUser.totalReferrals : null;

    // Example 2: Incrementing referredUsers field
    if (referredByUser) {
        let commissionRate = 0.17; // Default commission rate for tier 0
        if (referredByUserTotalReferrals !== null) {
        if (referredByUserTotalReferrals >= 9) commissionRate = 0.3;
        else if (referredByUserTotalReferrals >= 6) commissionRate = 0.25;
        else if (referredByUserTotalReferrals >= 3) commissionRate = 0.20;
      }
      const commission = commissionRate * (referredByUserRole === 'crypto' ? 2 : 3000);
  
      const revenueAdd = referredByUserRole === 'crypto' ? 2 : 1333;

       // Update referrer's commission
       await User.updateOne(
        { userId: userId },
        {
          $inc: { referralsCount: 1, totalReferrals: 1, referralsBalance: commission, referredUsers: -1, weeklyEarnings: commission, reserveAccountLimit: revenueAdd}
        }
      );

      response.send({ status: "successful", referrerData: referredByUser });

    } else {
      response.send({ status: "failed" });
    }
  } catch (error) {
    response.status(500).send(error);
  }
});

// end of update user data

router.get("/userExists/:userIdentification", async (request, response) => {
  try {
    const userId = request.params.userIdentification;
    const userExists = await User.findOne({ userId: userId });

    if(userExists){
      response.send({status: true, data: userExists})
    }
    else{
      response.send({status: false})
    }
  } catch (error) {
    response.status(500).send(error);
  }
});


// check referral code
router.get("/checkUserReferral/:userReferral", async (request, response) => { 
  try {
    const userReferralCode = request.params.userReferral;
    const referrerExists = await User.findOne({ referralCode: userReferralCode});

    if(referrerExists){
      response.send({"referrerInfo": referrerExists,
      "status": "true",
    })
    }
    else{
      response.send({"status": "false"})
    }
  } catch (error) {
    response.status(500).send(error);
  }
});
// end of check referral code

router.get("/userDetail/:userId", async (request, response) => { 
  try {
    const userId = request.params.userId;
    const user = await User.findOne({ userId: userId});

    response.send(user);
  } catch (error) {
    response.status(500).send(error);
  }
});

// transactions backend
// create TX

// Define a Mongoose schema for transactions
const transactionSchema = new mongoose.Schema({
  transactionReference: String,
  email: String,
  amount: Number,
  userID: String,
  status: String,
  timestamp: Date,
  transactionType: String,
  paymentID: String
});

// Create a model based on the schema
const Transaction = mongoose.model('Transaction', transactionSchema, 'transactions');

// Define a route to handle transaction creation
router.post('/createTransactions', async (request, response) => {
  try {
    const txDetails = request.body;

    // Create a new transaction document
    const newTransaction = new Transaction(txDetails);

    // Save the transaction to the MongoDB collection
    await newTransaction.save();

    response.status(201).json({ message: 'Transaction document written' });
  } catch (error) {
    console.error('Error adding transaction document: ', error);
    response.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET USER TRANSACTIONS
// Define a route to get user transactions
router.get('/getUserTransactions', async (request, response) => {
  const { userID } = request.query;

  try {
    // Create a query to filter transactions by the user's ID
    const userTransactions = await Transaction.find({ userID });

    response.status(200).json(userTransactions);
  } catch (error) {
    console.error('Error fetching user transactions: ', error);
    response.status(500).json({ error: 'Internal Server Error' });
  }
});



// get pending deposits and transactions
router.get('/getBtcDeposits', async (req, res) => {
  try {
    const btcDeposits = await PaymentCallback.find({order_description: 'Crypto Deposit'});
    res.json(btcDeposits);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// handling crypto account activation
router.put('/updatePaymentStatusAndDelete/:transactionId', async (request, response) => {
  try {
    const { transactionId } = request.params;
    const { newStatus, userId } = request.body;

    // Update payment status in the database
    await Transaction.findOneAndUpdate(
      { paymentID: transactionId},
      { status: newStatus },
      { new: true }
    );

    if(newStatus === 'success'){
      const currentUser = await User.findOne({ userId });
      const currentUserReferrerId = currentUser.referredBy;
      const currentUserReferrer = await User.findOne({ userId: currentUserReferrerId });
      
  
      const currentUserIsActive = currentUser.isUserActive;
      const currentUserReferralRedeemed = currentUser.referralRedeemed;
      const currentUserReferrerTotalReferrals = currentUserReferrer ? currentUserReferrer.totalReferrals : null;
  
  
      // Check if the referral commission has been redeemed
      if (!currentUserReferralRedeemed && currentUserReferrerId !== 'none') {
        // Calculate commission based on referral tier
        let commissionRate = 0.17; // Default commission rate for tier 0
        if (currentUserReferrerTotalReferrals !== null) {
          if (currentUserReferrerTotalReferrals >= 9) commissionRate = 0.3;
          else if (currentUserReferrerTotalReferrals >= 6) commissionRate = 0.25;
          else if (currentUserReferrerTotalReferrals >= 3) commissionRate = 0.20;
        }
        // note that this commission is coming from a crypto account
        const commission = commissionRate * (currentUserReferrer.role === 'crypto' ? 20 : 14000);
        const revenueAdd = currentUserReferrer.role === 'crypto' ? 2 : 1333;
  
        // Update referrer's commission
        await User.updateOne(
          { userId: currentUserReferrerId },
          {
            $inc: { referralsCount: 1, totalReferrals: 1, referralsBalance: commission, referredUsers: -1, weeklyEarnings: commission, reserveAccountLimit: revenueAdd }
          }
        );
      }
  
      // Update current user's account balance
      
      if (!currentUserIsActive) {
        // Update user's balance after account activation
        await User.updateOne(
          { userId },
          {
            $set: { isUserActive: true, referralRedeemed: true, hasPaid: true },
            $inc: { deposit: 20, dailyDropBalance: 10 }
          }
        );
      } else {
        // Update user's balance after account activation (without dailyDropBalance increment)
        await User.updateOne(
          { userId },
          {
            $set: { isUserActive: true, referralRedeemed: true, hasPaid: true },
            $inc: { deposit: 20 }
          }
        );
      }
  
    }
    // Delete the document
    await PaymentCallback.deleteOne({ payment_id : transactionId });

    response.sendStatus(200); // Respond with success status
  } catch (error) {
    console.error('Error updating payment status and deleting document:', error);
    response.status(500).send('Error updating payment status and deleting document');
  }
});



// 
// GET BTC FUNDING TX
// get pending deposits and transactions
router.get('/getBtcFundings', async (req, res) => {
  try {
    const btcDeposits = await PaymentCallback.find({order_description: 'Crypto Fund'});
    res.json(btcDeposits);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// handling crypto account activation
router.put('/updateUserBalance/:transactionId', async (request, response) => {
  try {
    const { transactionId } = request.params;
    const { newStatus, userId, price_amount } = request.body;

    // Update payment status in the database
    await Transaction.findOneAndUpdate(
      { paymentID: transactionId},
      { status: newStatus },
      { new: true }
    );

    // Update current user's account balance
      if(newStatus === 'success'){
        await User.updateOne(
          { userId },
          {
            $inc: { referralsBalance: price_amount, weeklyReferrals: price_amount }
          }
        );
      }
      

    // Delete the document
    await PaymentCallback.deleteOne({ payment_id : transactionId });

    response.sendStatus(200); // Respond with success status
  } catch (error) {
    console.error('Error updating user balance and deleting document:', error);
    response.status(500).send('Error updating user balance and deleting document');
  }
});


// // GET BTC WITHDRAWAL TX
// get pending deposits and transactions
router.get('/getBtcWithdrawals', async (req, res) => {
  try {
    const btcDeposits = await PaymentCallback.find({order_description: 'Crypto Withdrawal'});
    res.json(btcDeposits);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// handling crypto account activation
router.put('/updateUserWithdrawal/:transactionId', async (request, response) => {
  try {
    const { transactionId } = request.params;
    const { newStatus, userId, price_amount } = request.body;

    // Update payment status in the database
    await Transaction.findOneAndUpdate(
      { paymentID: transactionId},
      { status: newStatus },
      { new: true }
    );

    // Update current user's account balance
      if(newStatus === 'success'){
        await User.updateOne(
          { userId },
          {
            $inc: { referralsBalance: -price_amount }
          }
        );
      }
      

    // Delete the document
    await PaymentCallback.deleteOne({ payment_id : transactionId });

    response.sendStatus(200); // Respond with success status
  } catch (error) {
    console.error('Error updating user balance and deleting document:', error);
    response.status(500).send('Error updating user balance and deleting document');
  }
});

// ...
router.delete("/userDetail", async (request, response) => { 
  try {
    const users = await User.findByIdAndDelete('id');
    response.send(users);
  } catch (error) {
    response.status(500).send(error);
  }
});




module.exports = router;
