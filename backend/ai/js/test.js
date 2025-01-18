import { generateSchedulesFromInput } from "./scheduleProcessor.js";

async function test() {
  try {
    // You can test either with raw text or an audio file.
    const result = await generateSchedulesFromInput({
    //   rawText: "I want to mandatory register COMP1405, COMP1805, MATH1007, BIOL1902, PSYC1001"
      // Or use an audio file by providing:
      audioFilePath: "test3.m4a"
    });
    console.log("Final Schedules JSON:\n", JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("Error during test:", err);
  }
}

test();
