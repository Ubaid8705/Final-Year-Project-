import User from '../models/User.js';

// Get current user profile
export const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching user profile' });
  }
};

// Update user profile
export const updateUser = async (req, res) => {
  try {
    const allowedUpdates = [
      'username',
      'name',
      'email',
      'avatar',
      'bio',
      'pronouns',
      'hasSubdomain',
      'customDomainState'
    ];

    const updates = Object.keys(req.body)
      .filter(key => allowedUpdates.includes(key))
      .reduce((obj, key) => {
        obj[key] = req.body[key];
        return obj;
      }, {});

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    if (error.code === 11000) { // Duplicate key error
      res.status(400).json({ error: 'Username already taken' });
    } else {
      res.status(500).json({ error: 'Error updating user profile' });
    }
  }
};

// Delete user account
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    req.logout();
    res.json({ message: 'User account deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting user account' });
  }
};

// Get user by username (public profile)
export const getUserByUsername = async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username })
      .select('-providerId -provider'); // Exclude sensitive information

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching user profile' });
  }
};