import "dotenv/config";
import http from "http";
import { createApp } from "./app.js";
import { initSocketIo } from "./infrastructure/realtime/socket.js";
import { startWorkoutReminderScheduler } from "./infrastructure/scheduler/workout-reminders.js";
import { startMealReminderScheduler } from "./infrastructure/scheduler/meal-reminders.js";
import { startWeeklyTrainerDigestScheduler } from "./infrastructure/scheduler/weekly-trainer-digest.js";
const port = Number(process.env.PORT ?? 4000);
const app = createApp();
const server = http.createServer(app);
initSocketIo(server);
startWorkoutReminderScheduler();
startMealReminderScheduler();
startWeeklyTrainerDigestScheduler();
function listen(retriesLeft = 5) {
    server.once("error", (err) => {
        if (err.code === "EADDRINUSE" && retriesLeft > 0) {
            console.warn(`Port ${port} in use, retrying in 500ms... (${retriesLeft} left)`);
            setTimeout(() => listen(retriesLeft - 1), 500);
        }
        else {
            console.error(err);
            process.exit(1);
        }
    });
    server.listen(port, () => {
        console.log(`Backend listening on :${port}`);
    });
}
listen();
