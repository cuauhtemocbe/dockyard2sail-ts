// Hello World TypeScript Application
console.log("Hello, World! 🌍");

// Simple function to demonstrate TypeScript
function greetUser(name: string): string {
  return `Hola, ${name}! Bienvenido a la plantilla de TypeScript.`;
}

// Demo function with async/await
async function fetchData(): Promise<string> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve("Data loaded successfully!");
    }, 1000);
  });
}

// Function to add the pipeline element
function addPipelineElement(): void {
  const app = document.getElementById("app");
  if (!app) return;

  // Add CSS styles for the pipeline
  const style = document.createElement("style");
  style.textContent = `
    .pipeline {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      margin: 2rem auto;
      padding: 2rem;
      background: #f8fafc;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      max-width: 400px;
    }

    .step {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      padding: 1.5rem;
      background: white;
      border-radius: 12px;
      border: 2px solid #e2e8f0;
      width: 100%;
      max-width: 300px;
      text-align: center;
      opacity: 0.3;
      transition: all 0.5s ease;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    }

    .step.visible {
      opacity: 1;
      transform: scale(1.05);
      border-color: #667eea;
      box-shadow: 0 8px 25px rgba(102, 126, 234, 0.15);
    }

    .step .icon {
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }

    .step .title {
      font-weight: 600;
      color: #1a1a1a;
      font-size: 0.9rem;
      margin-bottom: 0.5rem;
    }

    .step .terminal {
      font-family: 'Courier New', monospace;
      background: #1a1a1a;
      color: #10b981;
      padding: 0.5rem;
      border-radius: 6px;
      font-size: 0.75rem;
      white-space: nowrap;
    }

    .arrow {
      font-size: 1.5rem;
      color: #667eea;
      font-weight: bold;
      transform: rotate(90deg);
    }

    @media (max-width: 768px) {
      .pipeline {
        padding: 1.5rem;
      }
      
      .step {
        max-width: 280px;
      }
    }
  `;
  document.head.appendChild(style);

  // Create pipeline HTML
  const pipelineHTML = `
    <div class="pipeline">
      <div id="step1" class="step">
        <span class="icon">⚒️</span>
        <div class="title">Desarrollo Local</div>
        <div class="terminal">user@developer:~$ pnpm dev</div>
      </div>
      <div class="arrow">🡪</div>
      <div id="step2" class="step">
        <span class="icon">📤</span>
        <div class="title">Subida a Git</div>
        <div class="terminal">user@developer:~$ git push</div>
      </div>
      <div class="arrow">🡪</div>
      <div id="step3" class="step">
        <span class="icon">🚀</span>
        <div class="title">Deploy Automático</div>
        <div class="terminal">ci-bot@runner:~$ deploy --railway</div>
      </div>
    </div>
  `;

  // Insert the pipeline after the current content
  app.insertAdjacentHTML("beforeend", pipelineHTML);

  // Start the animation loop
  playLoop();
}

// Animation function for the pipeline
async function playLoop(): Promise<void> {
  function delay(ms: number): Promise<void> {
    return new Promise((res) => setTimeout(res, ms));
  }

  const steps = ["step1", "step2", "step3"];

  while (true) {
    steps.forEach((id) => {
      const element = document.getElementById(id);
      if (element) element.classList.remove("visible");
    });
    await delay(500);

    for (const stepId of steps) {
      const element = document.getElementById(stepId);
      if (element) element.classList.add("visible");
      await delay(1500);
    }

    await delay(2000);
  }
}

// Initialize the application
async function init(): Promise<void> {
  const userName = "Developer";
  const greeting = greetUser(userName);

  console.log(greeting);

  // Update DOM if we're in a browser environment
  if (typeof document !== "undefined") {
    const app = document.getElementById("app");
    if (app) {
      app.innerHTML = `
        <div style="padding: 3rem 2rem; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; max-width: 500px; margin: 0 auto;">
          <h1 style="color: #1a1a1a; margin-bottom: 0.5rem; font-weight: 300; font-size: 2rem; letter-spacing: -0.02em;">
            🚀 TypeScript Boilerplate
          </h1>
          <p style="color: #6b7280; margin-bottom: 2rem; font-size: 0.95rem; line-height: 1.5;">
            ${greeting}
          </p>
          
          <div style="margin: 2rem 0; color: #667eea; font-weight: 500; font-size: 1.1rem;">
            ⚓ dockyard2sail-ts 🚢
          </div>
          <p style="color: #6b7280; font-size: 0.875rem; line-height: 1.6; margin: 0 0 2rem 0; max-width: 400px; margin-left: auto; margin-right: auto;">
            Un boilerplate moderno y listo para producción con TypeScript, pnpm, Docker y DevContainers, con pipeline completo de CI/CD. Permite iniciar rápido el desarrollo local, validar con hooks de Git y desplegar fácilmente a producción.
          </p>
          
          <div id="status" style="margin-top: 2rem; padding: 1rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 0.9rem;">
            <div style="display: inline-flex; align-items: center; gap: 0.5rem;">
              <div style="width: 16px; height: 16px; border: 2px solid #e2e8f0; border-top: 2px solid #667eea; border-radius: 50%; animation: spin 1s linear infinite;"></div>
              <span style="color: #64748b;">Loading...</span>
            </div>
          </div>
        </div>
      `;

      const statusEl = document.getElementById("status");
      if (statusEl) {
        try {
          const data = await fetchData();
          statusEl.innerHTML = `
            <div style="display: inline-flex; align-items: center; gap: 0.5rem;">
              <span style="color: #10b981; font-size: 1.1rem;">✅</span>
              <span style="color: #374151; font-weight: 500;">${data}</span>
            </div>
          `;

          // Add the pipeline element after successful data load
          addPipelineElement();
        } catch (error) {
          statusEl.innerHTML = `
            <div style="display: inline-flex; align-items: center; gap: 0.5rem;">
              <span style="color: #ef4444; font-size: 1.1rem;">❌</span>
              <span style="color: #374151; font-weight: 500;">Error: ${error}</span>
            </div>
          `;
        }
      }
    }
  } else {
    try {
      const data = await fetchData();
      console.log(data);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  }
}

// Start the application
init();

// Export for testing
export { greetUser, fetchData };
