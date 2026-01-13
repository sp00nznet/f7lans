/**
 * File Share Controller
 */

let fileShareService = null;
let groupService = null;

const initialize = (fileSvc, groupSvc) => {
  fileShareService = fileSvc;
  groupService = groupSvc;
};

const getStatus = async (req, res) => {
  try {
    if (!fileShareService) {
      return res.status(503).json({ error: 'File share service not initialized' });
    }
    res.json(fileShareService.getStatus());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const setEnabled = async (req, res) => {
  try {
    if (!fileShareService) {
      return res.status(503).json({ error: 'File share service not initialized' });
    }
    const { enabled } = req.body;
    const result = fileShareService.setEnabled(enabled);
    res.json({ message: enabled ? 'File sharing enabled' : 'File sharing disabled', ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const shareFolder = async (req, res) => {
  try {
    if (!fileShareService) {
      return res.status(503).json({ error: 'File share service not initialized' });
    }

    // Check permission
    if (groupService && !groupService.userHasPermission(req.user.id, 'file-share', req.user.isAdmin)) {
      return res.status(403).json({ error: 'You do not have permission to share files' });
    }

    const { folderPath, folderName } = req.body;
    if (!folderPath || !folderName) {
      return res.status(400).json({ error: 'Folder path and name are required' });
    }

    const result = fileShareService.shareFolder(req.user.id, req.user.username, folderPath, folderName);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const unshareFolder = async (req, res) => {
  try {
    if (!fileShareService) {
      return res.status(503).json({ error: 'File share service not initialized' });
    }

    const { folderId } = req.params;
    const result = fileShareService.unshareFolder(req.user.id, folderId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getMySharedFolders = async (req, res) => {
  try {
    if (!fileShareService) {
      return res.status(503).json({ error: 'File share service not initialized' });
    }

    const folders = fileShareService.getMySharedFolders(req.user.id);
    res.json({ folders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAllSharedFolders = async (req, res) => {
  try {
    if (!fileShareService) {
      return res.status(503).json({ error: 'File share service not initialized' });
    }

    // Check permission
    if (groupService && !groupService.userHasPermission(req.user.id, 'file-share', req.user.isAdmin)) {
      return res.status(403).json({ error: 'You do not have permission to access shared files' });
    }

    const folders = fileShareService.getAllSharedFolders();
    res.json({ folders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getUserSharedFolders = async (req, res) => {
  try {
    if (!fileShareService) {
      return res.status(503).json({ error: 'File share service not initialized' });
    }

    // Check permission
    if (groupService && !groupService.userHasPermission(req.user.id, 'file-share', req.user.isAdmin)) {
      return res.status(403).json({ error: 'You do not have permission to access shared files' });
    }

    const { userId } = req.params;
    const folders = fileShareService.getUserSharedFolders(userId);
    res.json({ folders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getFolderContents = async (req, res) => {
  try {
    if (!fileShareService) {
      return res.status(503).json({ error: 'File share service not initialized' });
    }

    // Check permission
    if (groupService && !groupService.userHasPermission(req.user.id, 'file-share', req.user.isAdmin)) {
      return res.status(403).json({ error: 'You do not have permission to access shared files' });
    }

    const { userId, folderId } = req.params;
    const { subPath } = req.query;
    const contents = await fileShareService.requestFolderContents(req.user.id, userId, folderId, subPath || '');
    res.json({ contents });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const requestDownload = async (req, res) => {
  try {
    if (!fileShareService) {
      return res.status(503).json({ error: 'File share service not initialized' });
    }

    // Check permission
    if (groupService && !groupService.userHasPermission(req.user.id, 'file-share', req.user.isAdmin)) {
      return res.status(403).json({ error: 'You do not have permission to access shared files' });
    }

    const { userId, folderId } = req.params;
    const { filePath } = req.body;
    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }

    const downloadInfo = await fileShareService.requestFileDownload(req.user.id, userId, folderId, filePath);
    res.json(downloadInfo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  initialize,
  getStatus,
  setEnabled,
  shareFolder,
  unshareFolder,
  getMySharedFolders,
  getAllSharedFolders,
  getUserSharedFolders,
  getFolderContents,
  requestDownload
};
