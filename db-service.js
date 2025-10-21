const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

class DatabaseService {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
  }

  // 初始化数据库连接
  async init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('打开数据库失败:', err);
          reject(err);
          return;
        }
        
        console.log('数据库连接成功');
        this.createTables().then(resolve).catch(reject);
      });
    });
  }

  // 创建所需的表
  async createTables() {
    return new Promise((resolve, reject) => {
      // 创建tags表，存储所有使用过的标签
      const createTagsTable = `
        CREATE TABLE IF NOT EXISTS tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL
        );
      `;

      this.db.run(createTagsTable, (err) => {
        if (err) {
          console.error('创建tags表失败:', err);
          // 继续执行，不阻止后续操作
        }
      });

      // 创建tasks表，存储任务历史
      const createTasksTable = `
        CREATE TABLE IF NOT EXISTS tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          duration INTEGER NOT NULL,
          completed_at TEXT NOT NULL,
          start_time TEXT NOT NULL,
          pauses TEXT,
          notes TEXT,
          tags TEXT
        );
      `;

      this.db.run(createTasksTable, (err) => {
        if (err) {
          console.error('创建表失败:', err);
          reject(err);
          return;
        }
        
        // 检查并添加notes字段（如果表已存在但没有notes字段）
        this.addNotesField().then(resolve).catch(reject);
      });
    });
  }
  
  // 添加notes和tags字段（兼容现有数据库）
  async addNotesField() {
    return new Promise((resolve, reject) => {
      // 检查表结构，使用更兼容的方式检查和添加字段
      this.db.all("PRAGMA table_info(tasks)", (err, rows) => {
        if (err) {
          console.error('检查表结构失败:', err);
          reject(err);
          return;
        }
        
        // 检查notes字段是否已存在
        const notesFieldExists = rows.some(row => row.name === 'notes');
        // 检查tags字段是否已存在
        const tagsFieldExists = rows.some(row => row.name === 'tags');
        
        const operations = [];
        
        if (!notesFieldExists) {
          operations.push(new Promise((resolveOp) => {
            this.db.run("ALTER TABLE tasks ADD COLUMN notes TEXT", (err) => {
              if (err) {
                console.error('添加notes字段失败:', err);
              } else {
                console.log('成功添加notes字段');
              }
              resolveOp();
            });
          }));
        } else {
          console.log('notes字段已存在');
        }
        
        if (!tagsFieldExists) {
          operations.push(new Promise((resolveOp) => {
            this.db.run("ALTER TABLE tasks ADD COLUMN tags TEXT", (err) => {
              if (err) {
                console.error('添加tags字段失败:', err);
              } else {
                console.log('成功添加tags字段');
              }
              resolveOp();
            });
          }));
        } else {
          console.log('tags字段已存在');
        }
        
        // 等待所有操作完成
        Promise.all(operations).then(resolve).catch(reject);
      });
    });
  }

  // 保存任务历史
  async saveTaskHistory(task) {
    console.log('dbService.saveTaskHistory被调用');
    console.log('传入的任务数据:', task);
    
    // 检查必要字段是否存在
    console.log('任务字段检查:');
    console.log('- name存在:', task.name !== undefined);
    console.log('- duration存在:', task.duration !== undefined);
    console.log('- completedAt存在:', task.completedAt !== undefined);
    console.log('- startTime存在:', task.startTime !== undefined);
    
    // 处理标签
    const tagsArray = task.tags || [];
    const tagsJson = JSON.stringify(tagsArray);
    
    // 保存标签到tags表（去重）
    if (tagsArray.length > 0) {
      await this.saveTags(tagsArray);
    }
    
    return new Promise((resolve, reject) => {
      const pausesJson = JSON.stringify(task.pauses || []);
      const notes = task.notes || '';
      
      const sql = `
        INSERT INTO tasks (name, duration, completed_at, start_time, pauses, notes, tags)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      
      console.log('准备执行SQL:', sql);
      console.log('SQL参数:', [task.name, task.duration, task.completedAt, task.startTime, pausesJson, notes]);
      
      this.db.run(sql, 
        [task.name, task.duration, task.completedAt, task.startTime, pausesJson, notes, tagsJson],
        function(err) {
          if (err) {
            console.error('保存任务失败:', err);
            reject(err);
            return;
          }
          console.log('任务保存成功，ID:', this.lastID);
          resolve({ success: true, id: this.lastID });
        }
      );
    });
  }

  // 获取所有任务历史
  async getTaskHistory() {
    console.log('dbService.getTaskHistory开始执行');
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM tasks ORDER BY completed_at DESC';
      
      this.db.all(sql, [], (err, rows) => {
        if (err) {
          console.error('获取任务历史失败:', err);
          reject(err);
          return;
        }
        
        console.log(`查询到${rows.length}个任务记录`);
        
        // 将数据库行转换为应用需要的格式
        const tasks = rows.map(row => {
          // 安全解析tags字段
          let parsedTags = [];
          if (row.tags) {
            try {
              parsedTags = JSON.parse(row.tags);
              // 确保解析结果是数组
              if (!Array.isArray(parsedTags)) {
                console.warn(`任务ID ${row.id} 的tags字段不是数组格式:`, row.tags);
                parsedTags = [];
              }
              console.log(`任务ID ${row.id} 解析后的标签:`, parsedTags);
            } catch (parseError) {
              console.error(`解析任务ID ${row.id} 的tags字段失败:`, parseError, row.tags);
              parsedTags = [];
            }
          }
          
          return {
            id: row.id,
            name: row.name,
            duration: row.duration,
            completedAt: row.completed_at,
            startTime: row.start_time,
            pauses: row.pauses ? JSON.parse(row.pauses) : [],
            notes: row.notes || '',
            tags: parsedTags
          };
        });
        
        console.log('任务数据转换完成，返回', tasks.length, '个任务');
        resolve(tasks);
      });
    });
  }

  // 更新任务备注
  async updateTaskNotes(taskId, notes) {
    return new Promise((resolve, reject) => {
      const sql = 'UPDATE tasks SET notes = ? WHERE id = ?';
      
      this.db.run(sql, [notes, taskId], function(err) {
        if (err) {
          console.error('更新任务备注失败:', err);
          reject(err);
          return;
        }
        
        if (this.changes === 0) {
          // 如果没有找到对应ID的任务，尝试使用索引逻辑
          return resolve(DatabaseService.handleUpdateNotesByIndex(taskId, notes));
        }
        
        resolve({ success: true });
      });
    });
  }
  
  // 兼容按索引更新备注的逻辑
  static async handleUpdateNotesByIndex(taskIndex, notes) {
    if (!dbService || !dbService.db) {
      throw new Error('数据库服务未初始化');
    }
    
    return new Promise((resolve, reject) => {
      dbService.db.all('SELECT id FROM tasks ORDER BY completed_at DESC', [], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (taskIndex >= 0 && taskIndex < rows.length) {
          const taskId = rows[taskIndex].id;
          dbService.db.run('UPDATE tasks SET notes = ? WHERE id = ?', [notes, taskId], function(err) {
            if (err) {
              reject(err);
              return;
            }
            resolve({ success: true });
          });
        } else {
          reject(new Error('任务索引无效'));
        }
      });
    });
  }
  
  // 删除单个任务
  async deleteTask(taskId) {
    return new Promise((resolve, reject) => {
      // 由于旧代码使用索引而非ID，我们需要通过ID删除
      // 但为了兼容性，我们仍然支持按索引删除
      const sql = 'DELETE FROM tasks WHERE id = ?';
      
      this.db.run(sql, [taskId], function(err) {
        if (err) {
          console.error('删除任务失败:', err);
          reject(err);
          return;
        }
        
        if (this.changes === 0) {
          // 如果没有找到对应ID的任务，尝试使用索引逻辑
          // 这是为了兼容旧代码
          return resolve(DatabaseService.handleDeleteByIndex(taskId));
        }
        
        resolve({ success: true });
      });
    });
  }

  // 兼容按索引删除的逻辑（处理旧代码的调用）
  static async handleDeleteByIndex(taskIndex) {
    // 直接使用现有的数据库服务实例，避免创建新实例
    if (!dbService || !dbService.db) {
      throw new Error('数据库服务未初始化');
    }
    
    return new Promise((resolve, reject) => {
      dbService.db.all('SELECT id FROM tasks ORDER BY completed_at DESC', [], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (taskIndex >= 0 && taskIndex < rows.length) {
          const taskId = rows[taskIndex].id;
          dbService.db.run('DELETE FROM tasks WHERE id = ?', [taskId], function(err) {
            if (err) {
              reject(err);
              return;
            }
            resolve({ success: true });
          });
        } else {
          reject(new Error('任务索引无效'));
        }
      });
    });
  }

  // 清除所有任务历史
  async clearTaskHistory() {
    return new Promise((resolve, reject) => {
      const sql = 'DELETE FROM tasks';
      
      this.db.run(sql, (err) => {
        if (err) {
          console.error('清除任务历史失败:', err);
          reject(err);
          return;
        }
        resolve({ success: true });
      });
    });
  }

  // 根据日期范围获取任务
  async getTasksByDateRange(startDate, endDate) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM tasks 
        WHERE completed_at >= ? AND completed_at <= ? 
        ORDER BY completed_at DESC
      `;
      
      this.db.all(sql, [startDate, endDate], (err, rows) => {
        if (err) {
          console.error('获取日期范围任务失败:', err);
          reject(err);
          return;
        }
        
        // 将数据库行转换为应用需要的格式
        const tasks = rows.map(row => ({
          id: row.id,
          name: row.name,
          duration: row.duration,
          completedAt: row.completed_at,
          startTime: row.start_time,
          pauses: row.pauses ? JSON.parse(row.pauses) : [],
          notes: row.notes || '',
          tags: row.tags ? JSON.parse(row.tags) : []
        }));
        
        resolve(tasks);
      });
    });
  }

  // 获取周统计数据
  async getWeekStats(startDate, endDate) {
    return new Promise((resolve, reject) => {
      try {
        // 首先获取指定日期范围内的所有任务
        this.getTasksByDateRange(startDate, endDate).then(tasks => {
          // 计算总时长和任务数量
          const totalDuration = tasks.reduce((sum, task) => sum + task.duration, 0);
          const taskCount = tasks.length;
          
          // 按日期分组统计
          const dailyStats = {};
          
          // 确保包含日期范围内的每一天
          const start = new Date(startDate);
          const end = new Date(endDate);
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            dailyStats[dateStr] = {
              date: dateStr,
              duration: 0,
              count: 0,
              tasks: []
            };
          }
          
          // 统计每天的任务数据
          tasks.forEach(task => {
            const dateStr = new Date(task.completedAt).toISOString().split('T')[0];
            if (dailyStats[dateStr]) {
              dailyStats[dateStr].duration += task.duration;
              dailyStats[dateStr].count += 1;
              dailyStats[dateStr].tasks.push(task);
            }
          });
          
          // 转换为数组格式并排序
          const dailyStatsArray = Object.values(dailyStats).sort((a, b) => 
            new Date(a.date) - new Date(b.date)
          );
          
          resolve({
            totalDuration,
            taskCount,
            dailyStats: dailyStatsArray
          });
        }).catch(reject);
      } catch (error) {
        console.error('计算周统计失败:', error);
        reject(error);
      }
    });
  }

  // 保存标签到tags表（去重）
  async saveTags(tags) {
    console.log('dbService.saveTags开始执行:', { tags, tagCount: tags.length });
    
    // 如果标签数组为空，则直接返回
    if (!tags || tags.length === 0) {
      console.log('标签数组为空，直接返回');
      return;
    }
    
    return new Promise((resolve, reject) => {
      // 使用事务批量插入
      console.log('开始数据库事务');
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');
        
        const sql = `INSERT OR IGNORE INTO tags (name, created_at) VALUES (?, ?)`;
        const now = new Date().toISOString();
        
        console.log('标签去重前:', { tags, count: tags.length });
        // 去重标签数组
        const uniqueTags = [...new Set(tags)];
        console.log('标签去重后:', { uniqueTags, count: uniqueTags.length });
        
        let errorOccurred = false;
        
        uniqueTags.forEach(tag => {
          if (!errorOccurred) {
            // 防止SQL注入
            const safeTag = tag.trim();
            console.log('处理标签:', { safeTag });
            
            this.db.run(sql, [safeTag, now], (err) => {
              if (err) {
                console.error('保存标签失败:', { error: err, tag: safeTag });
                errorOccurred = true;
              } else {
                console.log('标签处理成功:', { safeTag });
              }
            });
          }
        });
        
        this.db.run(errorOccurred ? 'ROLLBACK' : 'COMMIT', (err) => {
          if (err) {
            console.error('事务提交失败:', err);
            reject(err);
          } else {
            console.log('事务提交成功');
            resolve();
          }
        });
      });
    });
  }

  // 获取所有标签
  async getAllTags() {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT name FROM tags ORDER BY created_at DESC';
      
      this.db.all(sql, [], (err, rows) => {
        if (err) {
          console.error('获取标签失败:', err);
          reject(err);
          return;
        }
        
        const tags = rows.map(row => row.name);
        resolve(tags);
      });
    });
  }

  // 更新任务标签
  async updateTaskTags(taskId, tags) {
    console.log('dbService.updateTaskTags开始执行:', { taskId, tags, tagCount: tags?.length || 0 });
    
    try {
      const tagsArray = tags || [];
      // 将标签序列化为JSON
      const tagsJson = JSON.stringify(tagsArray);
      console.log('标签序列化为JSON:', { tagsJson });
      
      // 保存标签到tags表
      if (tagsArray.length > 0) {
        console.log('准备调用saveTags方法保存标签');
        await this.saveTags(tagsArray);
        console.log('saveTags方法执行完成');
      }
      
      // 创建Promise包装器以支持现有接口
      return new Promise((resolve, reject) => {
        // 更新任务的tags字段
        console.log('准备调用_updateTaskTagsInDB方法更新数据库');
        this._updateTaskTagsInDB(taskId, tagsJson, resolve, reject);
      });
    } catch (error) {
      console.error('updateTaskTags执行失败:', { error, message: error.message, stack: error.stack });
      throw error;
    }
  }

  // 内部方法：在数据库中更新任务标签
  _updateTaskTagsInDB(taskId, tagsJson, resolve, reject) {
    console.log('dbService._updateTaskTagsInDB开始执行:', { taskId, tagsJson });
    
    const sql = 'UPDATE tasks SET tags = ? WHERE id = ?';
    
    try {
      this.db.run(sql, [tagsJson, taskId], function(err) {
        if (err) {
          console.error('更新任务标签失败:', { error: err, taskId });
          reject(err);
          return;
        }
        
        console.log('UPDATE语句执行结果:', { changes: this.changes, taskId });
        
        if (this.changes === 0) {
          console.log('没有找到匹配id的任务，尝试使用index作为备用键');
          // 如果没有找到对应ID的任务，尝试使用索引逻辑
          return DatabaseService.handleUpdateTagsByIndex(taskId, tagsJson)
            .then(result => resolve(result))
            .catch(error => reject(error));
        }
        
        console.log(`成功更新了${this.changes}行数据`);
        const result = { success: true };
        console.log('_updateTaskTagsInDB执行成功:', result);
        resolve(result);
      });
    } catch (error) {
      console.error('_updateTaskTagsInDB执行失败:', { error, message: error.message, taskId, tagsJson });
      reject(error);
    }
  }
  
  // 获取任务通过ID
  async getTaskById(taskId) {
    console.log('dbService.getTaskById开始执行:', { taskId });
    try {
      return new Promise((resolve, reject) => {
        this.db.get(
          'SELECT * FROM tasks WHERE id = ?',
          [taskId],
          (err, row) => {
            if (err) {
              console.error('查询任务失败:', { error: err, taskId });
              reject(err);
              return;
            }
            
            if (!row) {
              console.log('任务不存在:', { taskId });
              resolve(null);
              return;
            }
            
            // 安全解析tags字段
            let parsedTags = [];
            if (row.tags) {
              try {
                parsedTags = JSON.parse(row.tags);
                // 确保解析结果是数组
                if (!Array.isArray(parsedTags)) {
                  console.warn(`任务ID ${row.id} 的tags字段不是数组格式:`, row.tags);
                  parsedTags = [];
                }
              } catch (parseError) {
                console.error(`解析任务ID ${row.id} 的tags字段失败:`, parseError, row.tags);
                parsedTags = [];
              }
            }
            
            const task = {
              id: row.id,
              name: row.name,
              duration: row.duration,
              completedAt: row.completed_at,
              startTime: row.start_time,
              pauses: row.pauses ? JSON.parse(row.pauses) : [],
              notes: row.notes || '',
              tags: parsedTags
            };
            
            console.log('获取任务结果:', { taskId, found: true, tagCount: task.tags.length });
            resolve(task);
          }
        );
      });
    } catch (error) {
      console.error('getTaskById执行失败:', { error, message: error.message, taskId });
      return null;
    }
  }

  // 兼容按索引更新标签的逻辑
  static async handleUpdateTagsByIndex(taskIndex, tagsJson) {
    console.log('DbService.handleUpdateTagsByIndex开始执行:', { taskIndex, tagsJson });
    
    if (!dbService || !dbService.db) {
      const error = new Error('数据库服务未初始化');
      console.error('handleUpdateTagsByIndex执行失败:', { error, message: error.message });
      throw error;
    }
    
    return new Promise((resolve, reject) => {
      console.log('获取所有任务ID并按时间降序排列');
      dbService.db.all('SELECT id FROM tasks ORDER BY completed_at DESC', [], (err, rows) => {
        if (err) {
          console.error('查询任务ID列表失败:', { error: err });
          reject(err);
          return;
        }
        
        console.log('任务ID列表查询结果:', { count: rows.length });
        
        if (taskIndex >= 0 && taskIndex < rows.length) {
          const taskId = rows[taskIndex].id;
          console.log('找到对应的任务ID:', { taskIndex, taskId });
          
          dbService.db.run('UPDATE tasks SET tags = ? WHERE id = ?', [tagsJson, taskId], function(err) {
            if (err) {
              console.error('按索引更新标签失败:', { error: err, taskId, taskIndex });
              reject(err);
              return;
            }
            
            console.log('按索引更新标签成功:', { taskId, taskIndex, changes: this.changes });
            resolve({ success: true });
          });
        } else {
          const error = new Error('任务索引无效');
          console.error('按索引更新标签失败:', { error, message: error.message, taskIndex, totalRows: rows.length });
          reject(error);
        }
      });
    });
  }

  // 关闭数据库连接
  close() {
    if (this.db) {
      this.db.close();
      console.log('数据库连接已关闭');
    }
  }
}

// 获取数据库文件路径
function getDatabasePath() {
  const userDataPath = app.getPath ? app.getPath('userData') : __dirname;
  return path.join(userDataPath, 'task_history.db');
}

// 导出数据库服务实例
let dbService = null;

function getDatabaseService() {
  if (!dbService) {
    const dbPath = getDatabasePath();
    dbService = new DatabaseService(dbPath);
  }
  return dbService;
}

module.exports = { getDatabaseService, getDatabasePath };
