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

server.listen(port, () => {
	console.log(`Backend listening on :${port}`);
});
