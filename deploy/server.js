/**
 * MonsterASP.NET entry point — must live in /wwwroot next to web.config.
 * Compiled API lives in ./dist/server.js
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
require('./dist/server.js');
