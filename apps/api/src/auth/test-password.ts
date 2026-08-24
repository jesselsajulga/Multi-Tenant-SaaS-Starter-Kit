import { hashPassword, verifyPassword } from "./password";

async function run() {
  const password = "MySuperSecretPassword123!";
  
  console.log("Original password:", password);
  
  // Hash it
  const hash = await hashPassword(password);
  console.log("Hashed password:", hash);
  
  // Verify correct password
  const isCorrect = await verifyPassword(password, hash);
  console.log("Verify correct password:", isCorrect ? "true" : "false");
  
  // Verify wrong password
  const isWrong = await verifyPassword("WrongPassword!", hash);
  console.log("Verify wrong password:", isWrong ? "true" : "false");
}

run().catch(console.error);
