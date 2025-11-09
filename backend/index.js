import "dotenv/config";
import http from "http";
import app from "./app.js";
import { connectDB } from "./utils/db.js";
import { initializeSeedData } from "./utils/seed.js";
import { configureSocketServer } from "./socket.js";

const PORT = process.env.PORT || 5001;

const startServer = async () => {
    try {
        await connectDB();
        await initializeSeedData();
        const server = http.createServer(app);
        configureSocketServer(server);
        server.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
};

startServer();

