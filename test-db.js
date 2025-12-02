// test-db.js
const mysql = require('mysql2/promise');

async function testConnection() {
    console.log("1. Attempting to connect to MySQL...");
    
    const config = {
        host: '127.0.0.1', 
        user: 'root', 
        password: 'traffic123', 
        database: 'traffic_system'
    };

    try {
        const connection = await mysql.createConnection(config);
        console.log("✅ SUCCESS! Connected to database.");
        
        const [rows] = await connection.execute('SELECT * FROM traffic_logs LIMIT 1');
        console.log("✅ SUCCESS! Read data from table.");
        console.log("Data found:", rows);
        
        await connection.end();
    } catch (err) {
        console.log("\n❌ CONNECTION FAILED!");
        console.log("Error Code:", err.code);
        console.log("Error Message:", err.message);
        
        if (err.code === 'ER_ACCESS_DENIED_ERROR') {
            console.log("\n👉 FIX: Your password 'traffic123' is wrong OR root user is locked.");
        }
        if (err.code === 'ECONNREFUSED') {
            console.log("\n👉 FIX: MySQL is not running. Run 'sudo systemctl start mysql'.");
        }
        if (err.code === 'ER_BAD_DB_ERROR') {
            console.log("\n👉 FIX: Database 'traffic_system' does not exist.");
        }
    }
}

testConnection();