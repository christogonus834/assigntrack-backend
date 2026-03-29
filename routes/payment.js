const express = require('express');
const router  = express.Router();
const axios   = require('axios');
const User    = require('../models/User');
const auth    = require('../middleware/auth');

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const PLAN_AMOUNT     = 200000; // ₦2,000 in kobo (Paystack uses kobo)

// ── POST Initialize Payment ──
router.post('/initialize', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email:        user.email,
        amount:       PLAN_AMOUNT,
        currency:     'NGN',
        reference:    'ASGN_' + user._id + '_' + Date.now(),
        callback_url: 'https://www.assign.epaybillz.com.ng/pages/payment-success.html',
        metadata: {
          userId:    user._id.toString(),
          userName:  user.name,
          plan:      'pro',
          custom_fields: [
            { display_name: 'User Name',  variable_name: 'user_name',  value: user.name },
            { display_name: 'Plan',       variable_name: 'plan',       value: 'Pro - ₦2,000/month' }
          ]
        }
      },
      {
        headers: {
          Authorization:  'Bearer ' + PAYSTACK_SECRET,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json({
      authorization_url: response.data.data.authorization_url,
      reference:         response.data.data.reference,
      access_code:       response.data.data.access_code
    });

  } catch (err) {
    console.error('Paystack init error:', err.response?.data || err.message);
    res.status(500).json({ message: 'Payment initialization failed.' });
  }
});

// ── GET Verify Payment ──
router.get('/verify/:reference', auth, async (req, res) => {
  try {
    const response = await axios.get(
      'https://api.paystack.co/transaction/verify/' + req.params.reference,
      {
        headers: { Authorization: 'Bearer ' + PAYSTACK_SECRET }
      }
    );

    const data = response.data.data;

    if (data.status !== 'success') {
      return res.status(400).json({ message: 'Payment not successful.', status: data.status });
    }

    // Extract userId from metadata or reference
    const userId = data.metadata?.userId || req.user.id;

    // Set subscription for 1 month
    const now    = new Date();
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + 1);

    const user = await User.findByIdAndUpdate(
      userId,
      {
        subscriptionPlan:   'pro',
        subscriptionStatus: 'active',
        subscriptionStart:  now,
        subscriptionExpiry: expiry
      },
      { new: true }
    ).select('-password');

    if (!user) return res.status(404).json({ message: 'User not found.' });

    // Update localStorage token data
    res.json({
      message: 'Payment successful! Pro plan activated.',
      user: {
        id:                 user._id,
        name:               user.name,
        email:              user.email,
        phone:              user.phone,
        profession:         user.profession,
        rank:               user.rank,
        organization:       user.organization,
        isAdmin:            user.isAdmin,
        subscriptionPlan:   user.subscriptionPlan,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionExpiry: user.subscriptionExpiry
      },
      expiry: expiry.toLocaleDateString('en-NG', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      })
    });

  } catch (err) {
    console.error('Paystack verify error:', err.response?.data || err.message);
    res.status(500).json({ message: 'Payment verification failed.' });
  }
});

// ── Paystack Webhook (auto-renew) ──
router.post('/webhook', async (req, res) => {
  try {
    const crypto    = require('crypto');
    const hash      = crypto
      .createHmac('sha512', PAYSTACK_SECRET)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(401).send('Invalid signature');
    }

    const event = req.body;

    if (event.event === 'charge.success') {
      const userId = event.data.metadata?.userId;
      if (userId) {
        const expiry = new Date();
        expiry.setMonth(expiry.getMonth() + 1);
        await User.findByIdAndUpdate(userId, {
          subscriptionPlan:   'pro',
          subscriptionStatus: 'active',
          subscriptionStart:  new Date(),
          subscriptionExpiry: expiry
        });
        console.log('✅ Webhook: Pro plan renewed for user', userId);
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.sendStatus(500);
  }
});

// ── GET Check subscription status ──
router.get('/status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    const now  = new Date();
    const isPro = user.subscriptionPlan === 'pro' &&
                  user.subscriptionExpiry &&
                  now < new Date(user.subscriptionExpiry);

    // Auto-expire if past date
    if (user.subscriptionPlan === 'pro' && !isPro) {
      await User.findByIdAndUpdate(req.user.id, { subscriptionStatus: 'expired' });
    }

    res.json({
      plan:    user.subscriptionPlan,
      status:  isPro ? 'active' : 'expired',
      isPro,
      expiry:  user.subscriptionExpiry
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;