const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { getDatabaseService } = require('./db-service');

// 数据库服务实例
let dbService = null;

let mainWindow;
let notificationWindow = null; // 通知窗口实例

// 创建主窗口函数
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    icon: path.join(__dirname, 'assets', 'tomato.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      // 启用页面跳转
      enableRemoteModule: false
    }
  });

  // 开发环境检测
  const isDev = !app.isPackaged;
  
  // 输出当前工作目录和文件系统信息，帮助调试
  console.log('当前应用目录:', __dirname);
  console.log('资源目录:', process.resourcesPath);
  console.log('是否为打包应用:', app.isPackaged);
  
  // 列出当前目录的文件，帮助调试
  try {
    const files = fs.readdirSync(__dirname);
    console.log('当前目录文件:', files);
    
    // 检查dist目录内容
    const distDirs = ['dist', path.join(__dirname, 'dist'), path.join(process.resourcesPath, 'app', 'dist')];
    distDirs.forEach(dir => {
      try {
        if (fs.existsSync(dir)) {
          console.log(`${dir} 目录存在，内容:`, fs.readdirSync(dir));
        } else {
          console.log(`${dir} 目录不存在`);
        }
      } catch (err) {
        console.log(`检查 ${dir} 目录出错:`, err.message);
      }
    });
  } catch (error) {
    console.error('读取目录失败:', error);
  }
  
  if (isDev) {
    // 开发环境：加载 Vite 开发服务器
    console.log('开发环境模式，加载 Vite 服务器');
    mainWindow.loadURL('http://localhost:3000');
  } else {
    // 生产环境：加载编译后的静态文件
    console.log('生产环境模式，加载静态文件');
    
    // 简化路径查找逻辑，专注于正确的打包路径
        const possiblePaths = [
        // 绝对路径：直接指向app/dist/index.html（打包后的实际路径）
        path.join(process.resourcesPath, 'app', 'dist', 'index.html'),
        // 备选路径：当前工作目录下的dist/index.html
        path.join(process.cwd(), 'dist', 'index.html'),
        // 开发模式可能的路径
        path.join(__dirname, 'dist', 'index.html')
        ];
    
    let foundPath = null;
    for (const testPath of possiblePaths) {
      console.log('尝试加载路径:', testPath);
      if (fs.existsSync(testPath)) {
        foundPath = testPath;
        console.log('找到静态文件:', foundPath);
        
        // 检查HTML文件是否包含预期内容
        try {
          const content = fs.readFileSync(testPath, 'utf8');
          console.log('HTML文件内容长度:', content.length);
          console.log('HTML文件开头:', content.substring(0, 100));
        } catch (e) {
          console.error('读取HTML文件失败:', e);
        }
        
        break;
      }
    }
    
    if (foundPath) {
      // 在加载前设置webPreferences，确保允许加载本地资源
      mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': ["default-src 'self' 'unsafe-inline' 'unsafe-eval'; img-src 'self' file://*"]
          }
        });
      });
      // 直接使用绝对路径加载文件，避免路径解析问题
      console.log(`尝试加载HTML文件: ${foundPath}`);
      
      // 监听资源加载错误
      mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
        console.error('资源加载失败:', {
          errorCode,
          errorDescription,
          url: validatedURL,
          isMainFrame
        });
      });
      
      // 监听控制台日志
      mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
        console.log(`页面控制台[${level}]: ${message} (${sourceId}:${line})`);
      });
      
      mainWindow.loadFile(foundPath).catch(error => {
        console.error('加载文件失败:', error);
        // 显示详细的错误信息
        mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>加载错误 - 番茄时钟</title>
          </head>
          <body style="font-family: Arial; padding: 20px;">
            <h1>页面加载失败</h1>
            <p>错误详情: ${error.message}</p>
            <p>尝试加载的路径: ${foundPath}</p>
          </body>
          </html>
        `)}`);
      });
    } else {
      console.error('无法找到静态文件，所有尝试的路径都不存在:', possiblePaths);
      // 如果所有路径都失败，创建一个详细的错误页面
      mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>错误 - 番茄时钟</title>
        </head>
        <body style="font-family: Arial; padding: 20px;">
          <h1>无法加载应用内容</h1>
          <p>找不到必要的应用文件。</p>
          <h3>系统信息:</h3>
          <p>应用目录: ${__dirname}</p>
          <p>资源目录: ${process.resourcesPath}</p>
          <p>是否打包: ${app.isPackaged}</p>
          <h3>尝试的路径:</h3>
          <pre>${possiblePaths.join('\n')}</pre>
        </body>
        </html>
      `)}`);
    }
  }
  
  // 添加页面加载完成事件监听，以便调试
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('页面加载完成');
  });
  
  // 添加页面加载失败事件监听
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('页面加载失败:', errorCode, errorDescription);
  });
  
  // 注意：不再加载renderer.js，避免与Vue应用冲突
  
  // 打开开发者工具以便调试
  // mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 应用准备就绪时创建窗口
app.whenReady().then(async () => {
  try {
    // 初始化数据库服务
    dbService = getDatabaseService();
    await dbService.init();
    
    // 尝试从旧的JSON文件导入数据到数据库
    await migrateFromJsonToDatabase();
    
    // 创建主窗口
    createMainWindow();
  } catch (error) {
    console.error('应用初始化失败:', error);
    // 即使数据库初始化失败，也创建主窗口，应用可能仍然可以运行
    createMainWindow();
  }
});

// 从旧的JSON文件迁移数据到数据库
async function migrateFromJsonToDatabase() {
  const historyPath = path.join(app.getPath('userData'), 'task_history.json');
  
  try {
    // 检查旧的JSON文件是否存在
    if (fs.existsSync(historyPath)) {
      console.log('检测到旧的JSON数据文件，开始迁移...');
      
      // 读取JSON数据
      const jsonData = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
      
      if (Array.isArray(jsonData) && jsonData.length > 0) {
        // 获取现有数据库中的任务数量，避免重复导入
        const existingTasks = await dbService.getTaskHistory();
        
        if (existingTasks.length === 0) {
          // 如果数据库是空的，则导入所有任务
          for (const task of jsonData) {
            await dbService.saveTaskHistory(task);
          }
          console.log(`成功迁移 ${jsonData.length} 条任务记录到数据库`);
          
          // 迁移完成后，可以选择删除旧文件
          // fs.unlinkSync(historyPath);
          // console.log('已删除旧的JSON数据文件');
        } else {
          console.log('数据库已有数据，跳过迁移');
        }
      }
    }
  } catch (error) {
    console.error('数据迁移失败:', error);
    // 迁移失败不应阻止应用启动
  }
}

// 关闭所有窗口时退出应用（Windows & Linux）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// macOS上点击dock图标时重新创建窗口
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

// 显示通知
// ipcMain.on('show-notification', (event, title, body) => {
//   if (Notification.isSupported()) {
//     new Notification({
//       title: title,
//       body: body,
//       icon: path.join(__dirname, 'assets', 'tomato.png')
//     }).show();
//   }
// });

// 显示任务完成弹窗
ipcMain.on('show-task-complete-window', (event, taskName) => {
  createNotificationWindow(taskName);
});

// 创建通知窗口
function createNotificationWindow(taskName) {
  // 如果已有通知窗口，则先关闭
  if (notificationWindow) {
    notificationWindow.close();
  }
  
  // 获取当前活动屏幕（鼠标所在的屏幕）
  const mousePoint = screen.getCursorScreenPoint();
  const activeScreen = screen.getDisplayNearestPoint(mousePoint);
  const { width, height } = activeScreen.workAreaSize;
  const { x, y } = activeScreen.workArea;
  
  // 窗口配置
  notificationWindow = new BrowserWindow({
    width: 340,
    height: 260,
    frame: false, // 无边框窗口
    transparent: true, // 透明背景
    alwaysOnTop: true, // 总是置顶
    resizable: false,
    show: false, // 先不显示，等内容加载后再显示
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false,
      enableBlinkFeatures: 'ModuleScripts'
    }
  });
  
  // 加载通知页面，传递任务名称
  notificationWindow.loadFile('notification.html', { query: { task: taskName } });
  
  // 窗口居中显示在当前活动屏幕
  notificationWindow.setPosition(
    Math.round(x + (width - 340) / 2),
    Math.round(y + (height - 240) / 2)
  );
  
  // 窗口加载完成后显示
  notificationWindow.once('ready-to-show', () => {
    notificationWindow.show();
  });
  
  // 窗口关闭时清空引用
  notificationWindow.on('closed', () => {
    notificationWindow = null;
  });
}

// 关闭通知窗口
ipcMain.on('close-notification', () => {
  if (notificationWindow) {
    notificationWindow.close();
  }
});

// 延长任务时间
ipcMain.on('extend-task-time', (event, minutes) => {
  if (mainWindow) {
    mainWindow.webContents.send('task-time-extended', minutes);
  }
});

// 移除了历史窗口相关的IPC处理，改为在渲染进程中使用页面跳转

// 保存任务历史
ipcMain.handle('save-task-history', async (event, task) => {
  console.log('收到保存任务历史的IPC请求');
  console.log('任务数据:', task);
  try {
    console.log('调用dbService.saveTaskHistory');
    const result = await dbService.saveTaskHistory(task);
    console.log('dbService.saveTaskHistory结果:', result);
    return result;
  } catch (error) {
    console.error('保存任务历史失败:', error);
    throw error;
  }
});

// 获取任务历史
ipcMain.handle('get-task-history', async (event) => {
  try {
    const history = await dbService.getTaskHistory();
    return history;
  } catch (error) {
    console.error('读取任务历史失败:', error);
    throw error;
  }
});

// 删除单个任务
ipcMain.handle('delete-task', async (event, taskIndex) => {
  try {
    const result = await dbService.deleteTask(taskIndex);
    return result;
  } catch (error) {
    console.error('删除任务失败:', error);
    throw error;
  }
});

// 更新任务备注
ipcMain.handle('update-task-notes', async (event, taskId, notes) => {
  try {
    await dbService.updateTaskNotes(taskId, notes);
    return true;
  } catch (error) {
    console.error('更新任务备注失败:', error);
    return false;
  }
});

// 获取指定日期范围的任务
ipcMain.handle('get-tasks-by-date-range', async (event, startDate, endDate) => {
  try {
    return await dbService.getTasksByDateRange(startDate, endDate);
  } catch (error) {
    console.error('获取日期范围任务失败:', error);
    return [];
  }
});

// 获取周统计数据
ipcMain.handle('get-week-stats', async (event, startDate, endDate) => {
  try {
    return await dbService.getWeekStats(startDate, endDate);
  } catch (error) {
    console.error('获取周统计失败:', error);
    return {
      totalDuration: 0,
      taskCount: 0,
      dailyStats: []
    };
  }
});

// 获取所有标签
ipcMain.handle('get-all-tags', async (event) => {
  try {
    const tags = await dbService.getAllTags();
    return tags;
  } catch (error) {
    console.error('获取标签失败:', error);
    return [];
  }
});

// 更新任务标签
  ipcMain.handle('update-task-tags', async (event, taskId, tags) => {
    console.log('收到更新任务标签请求:', { originalTaskId: taskId, originalTags: tags, tagsType: typeof tags, isArray: Array.isArray(tags) });
    try {
      // 参数验证与标准化
      const normalizedTaskId = Number(taskId);
      const normalizedTags = Array.isArray(tags) ? tags : [];
      console.log('标准化后的参数:', { taskId: normalizedTaskId, tags: normalizedTags, tagCount: normalizedTags.length });
      
      // 记录调用前的数据库服务状态
      console.log('准备调用dbService.updateTaskTags方法');
      
      // 调用数据库服务更新标签
      const dbResult = await dbService.updateTaskTags(normalizedTaskId, normalizedTags);
      
      // 记录数据库操作结果
      console.log('dbService.updateTaskTags方法调用完成，返回结果:', dbResult);
      
      // 返回成功结果
      const result = { success: true };
      console.log('更新任务标签成功:', result);
      return result;
    } catch (error) {
      console.error('更新任务标签失败:', { error, message: error.message, stack: error.stack });
      return { success: false, error: error.message };
    }
  });

// 清除任务历史
ipcMain.handle('clear-task-history', async (event) => {
  try {
    const result = await dbService.clearTaskHistory();
    return result;
  } catch (error) {
    console.error('清除任务历史失败:', error);
    throw error;
  }
});

ipcMain.handle('getPrimaryDisplay', (event) => {
  // 获取当前鼠标指针的位置
  const cursorPoint = screen.getCursorScreenPoint()
  // 根据鼠标所在位置，返回对应的 display
  const display = screen.getDisplayNearestPoint(cursorPoint)
  return display
});

// 应用退出时关闭数据库连接
app.on('will-quit', () => {
  if (dbService) {
    dbService.close();
  }
});