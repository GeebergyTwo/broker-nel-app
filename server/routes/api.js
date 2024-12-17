// my-app/server/routes/api.js
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const User = require('../model');
const { MongoClient } = require('mongodb');
const cron = require('node-cron');
const axios = require('axios');

const uri = process.env.uri;
// const uri = "mongodb+srv://nexusfxinvestmentblog:nexusfxpassword@nexusfx.mjiu6l6.mongodb.net/userData?retryWrites=true&w=majority";

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
  username: String,
  payment_status: String,
  pay_address: String,
  price_amount: Number,
  paymentID: String,
  description: String,
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
// Backend (Express) - Route to Add Participants
router.post('/debitUser', async (req, res) => {
  try {
    const { userId, fee } = req.body;

    // Update user balance
    const updatedUser = await User.findOneAndUpdate(
      { userId: userId },
      { $inc: { balance: -fee } }, // Deduct the fee from the balance
      { new: true } // Return the updated user document
    );

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.status(200).json({ message: 'User debited successfully!' });
  } catch (error) {
    console.error('Error debiting user:', error);
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


// Check referral code
// check referral code
router.get("/checkUserReferral/:userReferral", async (request, response) => { 
  try {
    const userReferralCode = request.params.userReferral;
    const referrerExists = await User.findOne({ referralCode: userReferralCode });

    if (referrerExists) {
      response.status(200).send({
        referrerInfo: referrerExists,
        status: "true"
      });
    } else {
      response.status(200).send({
        status: "false",
        message: "Referral code not found"
      });
    }
  } catch (error) {
    response.status(200).send({
      status: "error",
      message: "An error occurred while checking the referral code"
    });
  }
});

// check agent code
router.get("/checkAgentCode/:agentCode", async (request, response) => {
  try {
    const { agentCode } = request.params;
    
    // Check if the agent code exists
    const agentExists = await User.findOne({ agentID: agentCode });

    if (agentExists) {
      return response.status(200).send({
        referrerInfo: agentExists,
        status: "true"
      });
    } else {
      return response.status(200).send({
        status: "false",
        message: "Agent code not found"
      });
    }
  } catch (error) {
    console.error(error);
    return response.status(200).send({
      status: "error",
      message: "An error occurred while checking the agent code"
    });
  }
});


// end of check agent code

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
  username: String,
  status: String,
  timestamp: Date,
  transactionsType: String,
  paymentID: String,
  description: String,
});

// Create a model based on the schema
const Transaction = mongoose.model('Transaction', transactionSchema, 'transactions');

const WalletAddressSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true, // e.g., 'tether', 'bitcoin', etc.
    unique: true
  },
  address: {
    type: String,
    required: true
  },
  memo: {
    type: String, // Optional, for coins like USDT that use memo
    default: ''
  },
  isDefault: {
    type: Boolean,
  }
});

const WalletAddress = mongoose.model('WalletAddress', WalletAddressSchema);

// Define a route to handle transaction creation
router.post('/createTransactions', async (request, response) => {
  try {
    const txDetails = request.body;

    // Create a new transaction document
    const newTransaction = new Transaction(txDetails);

    // Save the transaction to the MongoDB collection
    await newTransaction.save();

    response.status(201).json({ message: 'Transaction document written' });
    console.error('document added successfully');
  } catch (error) {
    console.error('Error adding transaction document: ', error);
    response.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/fetchWallets', async (req, res) => {
  const { agentCode } = req.query; // Get agentCode from the query parameter
  
  if (!agentCode) {
    return res.status(400).json({ error: 'Agent code is required' });
  }

  try {
    // Find the user by agentCode to check if they are the owner
    const user = await User.findOne({ agentID: agentCode });

    // If no user is found, return wallets with isDefault: true
    if (!user) {
      const defaultWallets = await WalletAddress.find({ isDefault: true });
      return res.status(200).json(defaultWallets); // Return the default wallets
    }

    if (user.isOwner) {
      // Fetch wallets where agentID matches the user's agentCode
      const walletAddresses = await WalletAddress.find({ agentID: agentCode });
      return res.status(200).json(walletAddresses); // Return the wallets that belong to the user
    } else {
      // If the user is not the owner, return the default wallets
      const walletAddresses = await WalletAddress.find({ isDefault: true });
      return res.status(200).json(walletAddresses); // Return the default wallet addresses
    }
  } catch (error) {
    console.error('Error fetching wallets:', error);
    res.status(500).json({ error: 'Server error' });
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
router.get('/getBtcDeposits/:agentID', async (req, res) => {
  try {
    // Get the current user's agentID (modify based on your authentication setup)
    const agentID = req.params.agentID;

    if (!agentID) {
      return res.status(400).json({ error: 'Agent ID is required' });
    }

    // Find users whose agentCode matches the agentID
    const users = await User.find({ agentCode: agentID });
    const userIds = users.map(user => user.userId);

    if (userIds.length === 0) {
      return res.status(404).json({ error: 'No users found for this agent' });
    }

    // Find BTC deposits made by these users
    const btcDeposits = await PaymentCallback.find({
      description: 'Deposit',
      userID: { $in: userIds },
    });

    // Send the filtered BTC deposits
    res.status(200).json(btcDeposits);
  } catch (error) {
    console.error('Error fetching BTC deposits:', error);
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

  
      const currentUserIsActive = currentUser.isUserActive;
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
    await PaymentCallback.deleteOne({ paymentID : transactionId });

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
    const btcDeposits = await PaymentCallback.find({description: 'Deposit'});
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
      

    // Delete the document
    await PaymentCallback.deleteOne({ paymentID : transactionId });

    response.sendStatus(200); // Respond with success status
  } catch (error) {
    console.error('Error updating user balance and deleting document:', error);
    response.status(500).send('Error updating user balance and deleting document');
  }
});


// // GET BTC WITHDRAWAL TX
// get pending deposits and transactions
// Get BTC withdrawal requests based on agentID
router.get('/getBtcWithdrawals/:agentID', async (req, res) => {
  try {
    const agentID = req.params.agentID;

    if (!agentID) {
      return res.status(400).json({ error: 'Agent ID is required' });
    }

    // Find users whose agentCode matches the agentID
    const users = await User.find({ agentCode: agentID });
    const userIds = users.map(user => user.userId);

    if (userIds.length === 0) {
      return res.status(404).json({ error: 'No users found for this agent' });
    }

    // Find BTC withdrawal requests made by these users
    const btcWithdrawals = await PaymentCallback.find({
      description: 'Withdrawal',
      userID: { $in: userIds },
    });

    // Send the filtered BTC withdrawals
    res.status(200).json(btcWithdrawals);
  } catch (error) {
    console.error('Error fetching BTC withdrawals:', error);
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
    await PaymentCallback.deleteOne({ paymentID : transactionId });

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

// Endpoint to get agentCode by user ID
router.get('/getAgentCode/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Query the database for the user
    const user = await User.findOne({ userId });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Respond with the agentCode
    res.status(200).json({ agentCode: user.agentCode });
  } catch (error) {
    console.error('Error fetching agentCode:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Define a schema and model
const scriptSchema = new mongoose.Schema({
  src: String,
  agentCode: String,
  isDefault: Boolean,
});

const Script = mongoose.model('Script', scriptSchema);

// Fetch the script URL
router.get('/script/:agentCode', async (req, res) => {
  try {
    const { agentCode } = req.params;

    if (!agentCode) {
      return res.status(400).json({ error: 'Agent Code is required' });
    }

    let script;

    if (agentCode !== 'none') {
      // Fetch the script based on the provided agentCode
      script = await Script.findOne({ agentCode });
    } else {
      // If agentCode is 'none', return a default script or an error message
      script = await Script.findOne({ isDefault: true }); // Assuming there's a default script
    }

    if (!script) {
      return res.status(404).json({ error: 'Script not found' });
    }

    res.status(200).json(script);
  } catch (error) {
    console.error('Error fetching script:', error);
    res.status(500).send('Internal Server Error');
  }
});

router.get('/users', async (req, res) => {
  try {
    const { agentID } = req.query;  // Get the agentID from query parameters
    
    // If agentID is provided, filter users based on agentCode
    const filter = agentID ? { agentCode: agentID } : {};

    const users = await User.find(filter); // Filter users based on agentCode (if provided)
    
    res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



router.put('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;  // Assuming the ID is passed in the URL
    const updatedUser = req.body;

    // Ensure the ID is valid and exists
    const user = await User.findByIdAndUpdate(userId, updatedUser, { new: true });

    if (!user) {
      return res.status(404).send('User not found');
    }

    res.json(user);
  } catch (error) {
    res.status(400).send('Error updating user: ' + error.message);
  }
});

router.post('/send-email', async (req, res) => {
  const { name, email, message } = req.body;
  const elasticEmailAPIKey = process.env.email_api_key;
  const toEmail = 'minterproorg@gmail.com';

  try {
    const response = await axios.post(
      'https://api.elasticemail.com/v2/email/send',
      new URLSearchParams({
        apikey: elasticEmailAPIKey,
        from: 'minterproorg@gmail.com',
        to: toEmail,
        subject: `Message from ${name}`,
        bodyHtml: `<p>${message}</p><p>From: ${name} (${email})</p>`,
      })
    );

    if (response.data.success) {
      res.status(200).send('Message sent successfully.');
    } else {
      throw new Error(response.data.error || 'Failed to send email.');
    }
  } catch (error) {
    console.error('Error sending email:', error.message);
    res.status(500).send('Failed to send your message.');
  }
});





module.exports = router;
