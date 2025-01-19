import { generateSchedulesFromInput } from "./scheduleProcessor.js";

async function generateSchedules() {
  try {
    const result = await generateSchedulesFromInput({
    //   rawText: "I want to mandatory register COMP1405, COMP1805, MATH1007, BIOL1902, PSYC1001"
      audioFilePath: "test3.m4a"
    });
    console.log("Final Schedules JSON:\n", JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("Error during test:", err);
  }
}

generateSchedules();
