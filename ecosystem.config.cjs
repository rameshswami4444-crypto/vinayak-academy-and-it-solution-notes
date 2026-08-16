module.exports = {
    apps: [
        {
            name: "vinayak-academy",
            script: "server.js",
            exec_mode: "fork",
            instances: 1,
            env: {
                NODE_ENV: "production"
            },
            max_memory_restart: "512M",
            time: true,
            kill_timeout: 10000,
            wait_ready: false,
            out_file: "./logs/pm2-out.log",
            error_file: "./logs/pm2-error.log"
        }
    ]
};
