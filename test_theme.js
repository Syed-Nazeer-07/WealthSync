// Theme System Verification Test
// Run in browser console

console.log("=== THEME SYSTEM VERIFICATION ===\n");

// 1. CHECK INITIAL STATE (LIGHT MODE)
console.log("1. LIGHT MODE STATE:");
console.log("  document.documentElement.classList:", Array.from(document.documentElement.classList).join(", ") || "none");
console.log("  localStorage.theme:", localStorage.getItem('theme'));

const bodyLight = window.getComputedStyle(document.body);
const cardLight = document.querySelector('[class*="rounded-3xl"]')?.parentElement || document.querySelector('main');
const cardStyleLight = window.getComputedStyle(cardLight);
const buttonLight = document.querySelector('button[class*="bg-brand"]');
const buttonStyleLight = window.getComputedStyle(buttonLight);

console.log("  body background:", bodyLight.backgroundColor);
console.log("  body text color:", bodyLight.color);
console.log("  card background:", cardStyleLight.backgroundColor);
console.log("  button background:", buttonStyleLight.backgroundColor);

// 2. TOGGLE TO DARK MODE
console.log("\n2. TOGGLING TO DARK MODE...");
App.toggleTheme();

// Wait for DOM to update
setTimeout(() => {
  console.log("\n3. DARK MODE STATE:");
  console.log("  document.documentElement.classList:", Array.from(document.documentElement.classList).join(", "));
  console.log("  localStorage.theme:", localStorage.getItem('theme'));
  
  const bodyDark = window.getComputedStyle(document.body);
  const cardDark = document.querySelector('[class*="rounded-3xl"]')?.parentElement || document.querySelector('main');
  const cardStyleDark = window.getComputedStyle(cardDark);
  const buttonDark = document.querySelector('button[class*="bg-brand"]');
  const buttonStyleDark = window.getComputedStyle(buttonDark);
  
  console.log("  body background:", bodyDark.backgroundColor);
  console.log("  body text color:", bodyDark.color);
  console.log("  card background:", cardStyleDark.backgroundColor);
  console.log("  button background:", buttonStyleDark.backgroundColor);
  
  // 4. COMPARE VALUES
  console.log("\n4. COLOR COMPARISON:");
  const bgSame = bodyLight.backgroundColor === bodyDark.backgroundColor;
  const textSame = bodyLight.color === bodyDark.color;
  const cardSame = cardStyleLight.backgroundColor === cardStyleDark.backgroundColor;
  const btnSame = buttonStyleLight.backgroundColor === buttonStyleDark.backgroundColor;
  
  console.log("  Background changed:", !bgSame ? "✓ YES" : "✗ NO - BROKEN");
  console.log("  Text color changed:", !textSame ? "✓ YES" : "✗ NO - BROKEN");
  console.log("  Card background changed:", !cardSame ? "✓ YES" : "✗ NO - BROKEN");
  console.log("  Button background changed:", !btnSame ? "✓ YES" : "✗ NO - BROKEN");
  
  // 5. TOGGLE BACK TO LIGHT
  console.log("\n5. TOGGLING BACK TO LIGHT MODE...");
  App.toggleTheme();
  
  setTimeout(() => {
    console.log("  document.documentElement.classList:", Array.from(document.documentElement.classList).join(", ") || "none");
    console.log("  localStorage.theme:", localStorage.getItem('theme'));
    console.log("\n=== TEST COMPLETE ===");
  }, 300);
}, 300);
