/**
 * Group Controller
 * Manages user groups and access control
 */

let groupService = null;

const initialize = (service) => {
  groupService = service;
};

// Group CRUD
const createGroup = async (req, res) => {
  try {
    if (!groupService) {
      return res.status(503).json({ error: 'Group service not initialized' });
    }
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Group name is required' });
    }
    const group = groupService.createGroup(name, description);
    res.json({ message: 'Group created', group });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateGroup = async (req, res) => {
  try {
    if (!groupService) {
      return res.status(503).json({ error: 'Group service not initialized' });
    }
    const { groupId } = req.params;
    const { name, description } = req.body;
    const group = groupService.updateGroup(groupId, { name, description });
    res.json({ message: 'Group updated', group });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteGroup = async (req, res) => {
  try {
    if (!groupService) {
      return res.status(503).json({ error: 'Group service not initialized' });
    }
    const { groupId } = req.params;
    const result = groupService.deleteGroup(groupId);
    res.json({ message: 'Group deleted', ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getGroup = async (req, res) => {
  try {
    if (!groupService) {
      return res.status(503).json({ error: 'Group service not initialized' });
    }
    const { groupId } = req.params;
    const group = groupService.getGroup(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    res.json({ group });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAllGroups = async (req, res) => {
  try {
    if (!groupService) {
      return res.status(503).json({ error: 'Group service not initialized' });
    }
    const groups = groupService.getAllGroups();
    res.json({ groups });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// User-Group membership
const addUserToGroup = async (req, res) => {
  try {
    if (!groupService) {
      return res.status(503).json({ error: 'Group service not initialized' });
    }
    const { groupId, userId } = req.params;
    const result = groupService.addUserToGroup(userId, groupId);
    res.json({ message: 'User added to group', ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const removeUserFromGroup = async (req, res) => {
  try {
    if (!groupService) {
      return res.status(503).json({ error: 'Group service not initialized' });
    }
    const { groupId, userId } = req.params;
    const result = groupService.removeUserFromGroup(userId, groupId);
    res.json({ message: 'User removed from group', ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getUserGroups = async (req, res) => {
  try {
    if (!groupService) {
      return res.status(503).json({ error: 'Group service not initialized' });
    }
    const { userId } = req.params;
    const groups = groupService.getUserGroups(userId);
    res.json({ userId, groups });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const setUserGroups = async (req, res) => {
  try {
    if (!groupService) {
      return res.status(503).json({ error: 'Group service not initialized' });
    }
    const { userId } = req.params;
    const { groupIds } = req.body;
    if (!groupIds || !Array.isArray(groupIds)) {
      return res.status(400).json({ error: 'Group IDs array is required' });
    }
    const result = groupService.setUserGroups(userId, groupIds);
    res.json({ message: 'User groups updated', ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getGroupMembers = async (req, res) => {
  try {
    if (!groupService) {
      return res.status(503).json({ error: 'Group service not initialized' });
    }
    const { groupId } = req.params;
    const members = groupService.getGroupMembers(groupId);
    res.json({ groupId, members });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Permissions
const setGroupPermissions = async (req, res) => {
  try {
    if (!groupService) {
      return res.status(503).json({ error: 'Group service not initialized' });
    }
    const { groupId } = req.params;
    const { permissions } = req.body;
    if (!permissions || typeof permissions !== 'object') {
      return res.status(400).json({ error: 'Permissions object is required' });
    }
    const result = groupService.setGroupPermissions(groupId, permissions);
    res.json({ message: 'Permissions updated', groupId, permissions: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getGroupPermissions = async (req, res) => {
  try {
    if (!groupService) {
      return res.status(503).json({ error: 'Group service not initialized' });
    }
    const { groupId } = req.params;
    const permissions = groupService.getGroupPermissions(groupId);
    res.json({ groupId, permissions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getMyPermissions = async (req, res) => {
  try {
    if (!groupService) {
      return res.status(503).json({ error: 'Group service not initialized' });
    }
    const permissions = groupService.getUserPermissions(req.user.id, req.user.isAdmin);
    const groups = groupService.getUserGroups(req.user.id);
    res.json({ userId: req.user.id, groups, permissions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAvailableFeatures = async (req, res) => {
  try {
    if (!groupService) {
      return res.status(503).json({ error: 'Group service not initialized' });
    }
    const features = groupService.getAvailableFeatures();
    res.json({ features });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const checkPermission = async (req, res) => {
  try {
    if (!groupService) {
      return res.status(503).json({ error: 'Group service not initialized' });
    }
    const { feature } = req.params;
    const hasPermission = groupService.userHasPermission(req.user.id, feature, req.user.isAdmin);
    res.json({ feature, hasPermission });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  initialize,
  createGroup,
  updateGroup,
  deleteGroup,
  getGroup,
  getAllGroups,
  addUserToGroup,
  removeUserFromGroup,
  getUserGroups,
  setUserGroups,
  getGroupMembers,
  setGroupPermissions,
  getGroupPermissions,
  getMyPermissions,
  getAvailableFeatures,
  checkPermission
};
