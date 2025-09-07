// Hello World TypeScript Application
console.log('Hello, World! 🌍');

// Simple function to demonstrate TypeScript
function greetUser(name: string): string {
  return `Hello, ${name}! Welcome to the TypeScript template.`;
}

// Demo function with async/await
async function fetchData(): Promise<string> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve('Data loaded successfully!');
    }, 1000);
  });
}

// Initialize the application
async function init(): Promise<void> {
  const userName = 'Developer';
  const greeting = greetUser(userName);
  
  console.log(greeting);
  
  // Update DOM if we're in a browser environment
  if (typeof document !== 'undefined') {
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = `
        <div style="padding: 2rem; text-align: center; font-family: Arial, sans-serif;">
          <h1 style="color: #333;">🚀 TypeScript Template</h1>
          <p style="color: #666;">${greeting}</p>
          <div id="status" style="margin-top: 1rem; padding: 1rem; background: #f5f5f5; border-radius: 8px;">
            Loading...
          </div>
        </div>
      `;
      
      const statusEl = document.getElementById('status');
      if (statusEl) {
        try {
          const data = await fetchData();
          statusEl.innerHTML = `<span style="color: green;">✅ ${data}</span>`;
        } catch (error) {
          statusEl.innerHTML = `<span style="color: red;">❌ Error: ${error}</span>`;
        }
      }
    }
  } else {
    try {
      const data = await fetchData();
      console.log(data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }
}

// Start the application
init();

// Export for testing
export { greetUser, fetchData };
