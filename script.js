/*
 * script.js
 *
 * This file contains the core logic for High Risk Wars. It defines the
 * game state, actions, random events, achievements and rendering logic
 * required to make the PWA feel interactive and engaging. At runtime
 * the DOM is manipulated to reflect changes in the game state. A
 * lightweight particle system provides animated atmosphere. Service
 * workers are registered when supported to enable offline capability.
 */

(() => {
  // Core game state object. This holds all mutable state used by the game.
  const gameState = {
    day: 1,
    money: 0,
    employees: 0,
    inventory: 0,
    processors: [],
    backupRails: false,
    altPay: false,
    sovPay: false,
    sovSats: false,
    stashApp: false,
    storeCount: 1,
    chargebackRate: 0, // expressed as percentage
    compliance: 50, // 0-100
    legalAwareness: 0, // 0-100
    processorShutdowns: 0,
    bitcoinEnabled: false,
    // Achievements flags
    achievements: {
      btcForever: false,
      firstShutdown: false,
      sovereign: false,
      jefe: false
    },
    // Internal counters
    daysWithBitcoin: 0
  };

  // Define starting packages available to the player.
  const startPackages = [
    {
      id: 'free',
      name: 'Free',
      money: 0,
      employees: 0,
      inventory: 0,
      processors: [],
      backupRails: false,
      altPay: false,
      sovPay: false,
      sovSats: false,
      stashApp: false,
      storeCount: 1,
      compliance: 50,
      description:
        'Start from nothing. You work out of a one‑room office. No processor, no backup rails. Difficulty: Hard.'
    },
    {
      id: 'plug',
      name: 'Plug Pack',
      money: 25000,
      employees: 1,
      inventory: 50,
      processors: ['Random Processor'],
      backupRails: false,
      altPay: false,
      sovPay: false,
      sovSats: false,
      stashApp: false,
      storeCount: 1,
      compliance: 55,
      description:
        'Your guy came through: +$25k, some inventory, a random processor and street cred.'
    },
    {
      id: 'bigperm',
      name: 'Big Perm Pack',
      money: 150000,
      employees: 3,
      inventory: 150,
      processors: [],
      backupRails: false,
      altPay: false,
      sovPay: false,
      sovSats: false,
      stashApp: false,
      storeCount: 2,
      compliance: 60,
      description:
        '+$150k, employees, warehouse, marketing team and compliance assistant.'
    },
    {
      id: 'jefe',
      name: 'The Jefe',
      money: 1000000,
      employees: 8,
      inventory: 300,
      processors: ['Processor'],
      backupRails: true,
      altPay: true,
      sovPay: true,
      sovSats: true,
      stashApp: true,
      storeCount: 3,
      compliance: 70,
      description:
        '$1M, warehouse, employees, processor, backup rails, bitcoin treasury. Everyone knows your name. Difficulty: VERY HARD.'
    }
  ];

  // Definitions of actionable options in the UI. Each action contains a
  // handler function that mutates gameState accordingly. Descriptive
  // information could be added here too in future iterations.
  const actions = [
    {
      id: 'buyInventory',
      label: 'Buy Inventory',
      handler: () => {
        const cost = 5000;
        if (gameState.money >= cost) {
          gameState.money -= cost;
          gameState.inventory += 50;
          addLog('Purchased 50 units of inventory.');
        } else {
          addLog('Not enough funds to buy inventory.');
        }
        updateStats();
      }
    },
    {
      id: 'runAds',
      label: 'Run Ads',
      handler: () => {
        const cost = 2000;
        if (gameState.money >= cost) {
          gameState.money -= cost;
          // Ads bring random revenue
          const revenue = Math.floor(Math.random() * 5000) + 5000;
          gameState.money += revenue;
          gameState.chargebackRate = Math.min(100, gameState.chargebackRate + 1);
          addLog(`Ads campaign generated $${revenue.toLocaleString()}. Chargebacks increased slightly.`);
        } else {
          addLog('Not enough funds to run ads.');
        }
        updateStats();
      }
    },
    {
      id: 'expand',
      label: 'Expand Business',
      handler: () => {
        const cost = 20000;
        if (gameState.money >= cost) {
          gameState.money -= cost;
          gameState.storeCount += 1;
          gameState.employees += 1;
          addLog('Expanded business to a new location and hired an employee.');
        } else {
          addLog('Not enough funds to expand.');
        }
        updateStats();
      }
    },
    {
      id: 'hire',
      label: 'Hire Employees',
      handler: () => {
        const cost = 10000;
        if (gameState.money >= cost) {
          gameState.money -= cost;
          gameState.employees += 1;
          addLog('Hired a new employee.');
        } else {
          addLog('Not enough funds to hire.');
        }
        updateStats();
      }
    },
    {
      id: 'improveCompliance',
      label: 'Improve Compliance',
      handler: () => {
        const cost = 5000;
        if (gameState.money >= cost) {
          gameState.money -= cost;
          gameState.compliance = Math.min(100, gameState.compliance + 10);
          addLog('Compliance improved.');
        } else {
          addLog('Not enough funds to improve compliance.');
        }
        updateStats();
      }
    },
    {
      id: 'refundPolicy',
      label: 'Improve Refund Policy',
      handler: () => {
        const cost = 3000;
        if (gameState.money >= cost) {
          gameState.money -= cost;
          gameState.chargebackRate = Math.max(0, gameState.chargebackRate - 2);
          addLog('Refund policy improved. Chargebacks decreased.');
        } else {
          addLog('Not enough funds to improve refund policy.');
        }
        updateStats();
      }
    },
    {
      id: 'applyProcessor',
      label: 'Apply for Processor',
      handler: () => {
        if (gameState.processors.length > 0) {
          addLog('You already have a processor.');
        } else {
          const chance = Math.random();
          if (gameState.compliance >= 50 && chance > 0.3) {
            const processors = ['Swipe™', 'MasterCharge™', 'Stash App™'];
            const newProc = processors[Math.floor(Math.random() * processors.length)];
            gameState.processors.push(newProc);
            addLog(`Your application was approved. You got a ${newProc} account.`);
          } else {
            addLog('Processor application denied. Work on your compliance.');
          }
        }
        updateStats();
      }
    },
    {
      id: 'addBackup',
      label: 'Add Backup Processor',
      handler: () => {
        const cost = 15000;
        if (gameState.money >= cost) {
          gameState.money -= cost;
          gameState.backupRails = true;
          addLog('Backup processor added. Business continuity improved.');
        } else {
          addLog('Not enough funds for a backup processor.');
        }
        updateStats();
      }
    },
    {
      id: 'enableBitcoin',
      label: 'Enable Bitcoin',
      handler: () => {
        if (!gameState.bitcoinEnabled) {
          gameState.bitcoinEnabled = true;
          gameState.altPay = true;
          gameState.sovPay = true;
          addLog('Bitcoin payments enabled via SOVPAY.');
        } else {
          addLog('Bitcoin already enabled.');
        }
        updateStats();
      }
    },
    {
      id: 'enableSOVPAY',
      label: 'Enable SOVPAY',
      handler: () => {
        if (!gameState.sovPay) {
          gameState.sovPay = true;
          addLog('SOVPAY enabled. You now accept Bitcoin and pay through SovSats.');
        } else {
          addLog('SOVPAY already enabled.');
        }
        updateStats();
      }
    },
    {
      id: 'enableSovSats',
      label: 'Enable SovSats',
      handler: () => {
        if (!gameState.sovSats) {
          gameState.sovSats = true;
          addLog('SovSats checkout enabled. Chargebacks reduced and processor dependency lowered.');
        } else {
          addLog('SovSats already enabled.');
        }
        updateStats();
      }
    },
    {
      id: 'enableAltPay',
      label: 'Enable AltPay Nexus',
      handler: () => {
        if (!gameState.altPay) {
          gameState.altPay = true;
          addLog('AltPay Nexus enabled. Backup rails established.');
        } else {
          addLog('AltPay Nexus already enabled.');
        }
        updateStats();
      }
    },
    {
      id: 'enableStash',
      label: 'Enable Stash App',
      handler: () => {
        if (!gameState.stashApp) {
          gameState.stashApp = true;
          addLog('Stash App enabled. Peer‑to‑peer payments unlocked.');
        } else {
          addLog('Stash App already enabled.');
        }
        updateStats();
      }
    },
    {
      id: 'openStore',
      label: 'Open Additional Store',
      handler: () => {
        const cost = 20000;
        if (gameState.money >= cost) {
          gameState.money -= cost;
          gameState.storeCount += 1;
          addLog('You opened a new store.');
        } else {
          addLog('Not enough funds to open a new store.');
        }
        updateStats();
      }
    },
    {
      id: 'reduceChargebacks',
      label: 'Reduce Chargebacks',
      handler: () => {
        const cost = 5000;
        if (gameState.money >= cost) {
          gameState.money -= cost;
          gameState.chargebackRate = Math.max(0, gameState.chargebackRate - 5);
          addLog('Invested in customer service and dispute resolution. Chargebacks reduced.');
        } else {
          addLog('Not enough funds to reduce chargebacks.');
        }
        updateStats();
      }
    },
    {
      id: 'nextDay',
      label: 'Next Day',
      handler: () => {
        processNextDay();
      }
    }
  ];

  // Random events definitions. Each event has a title, description and a set of
  // choices. Each choice is an object containing a label and an effect
  // function which mutates gameState when selected.
  const randomEvents = [
    {
      title: 'Processor Shutdown',
      description: 'Swipe™ terminates your account. You are now without a processor.',
      generateChoices: () => [
        {
          label: 'Appeal',
          effect: () => {
            const success = Math.random() > 0.5;
            if (success) {
              addLog('Your appeal succeeded. Your processor account is reinstated.');
            } else {
              if (gameState.processors.length > 0) {
                const removed = gameState.processors.pop();
                addLog(`Your appeal failed. ${removed} account permanently closed.`);
                gameState.processorShutdowns += 1;
              } else {
                addLog('No processor to lose.');
              }
            }
          }
        },
        {
          label: 'Find New Processor',
          effect: () => {
            const cost = 10000;
            if (gameState.money >= cost) {
              gameState.money -= cost;
              const processors = ['Swipe™', 'MasterCharge™', 'Stash App™'];
              const newProc = processors[Math.floor(Math.random() * processors.length)];
              gameState.processors.push(newProc);
              addLog(`You secured a new processor: ${newProc}.`);
            } else {
              addLog('Not enough funds to find a new processor.');
            }
          }
        },
        {
          label: 'Enable SOVPAY',
          effect: () => {
            if (!gameState.sovPay) {
              gameState.sovPay = true;
              addLog('SOVPAY enabled. Bitcoin to the rescue!');
            } else {
              addLog('SOVPAY already enabled.');
            }
          }
        },
        {
          label: 'Enable AltPay Nexus',
          effect: () => {
            if (!gameState.altPay) {
              gameState.altPay = true;
              addLog('AltPay Nexus enabled. Backup rails in place.');
            } else {
              addLog('AltPay Nexus already enabled.');
            }
          }
        },
        {
          label: 'Accept Fate',
          effect: () => {
            if (gameState.processors.length > 0) {
              const removed = gameState.processors.pop();
              addLog(`You accepted your fate. ${removed} account permanently closed.`);
              gameState.processorShutdowns += 1;
            } else {
              addLog('No processor to lose.');
            }
          }
        }
      ]
    },
    {
      title: 'Chargeback Storm',
      description: 'Chargebacks explode. Your chargeback ratio skyrockets.',
      generateChoices: () => [
        {
          label: 'Improve Refund Policy',
          effect: () => {
            const cost = 5000;
            if (gameState.money >= cost) {
              gameState.money -= cost;
              gameState.chargebackRate = Math.max(0, gameState.chargebackRate - 5);
              addLog('Invested in refunds. Chargebacks decreased.');
            } else {
              addLog('Not enough funds to improve refund policy.');
            }
          }
        },
        {
          label: 'Eat the Loss',
          effect: () => {
            const cost = 20000;
            if (gameState.money >= cost) {
              gameState.money -= cost;
              gameState.chargebackRate = Math.max(0, gameState.chargebackRate - 10);
              addLog('Paid chargebacks out of pocket. Chargebacks reset.');
            } else {
              addLog('Not enough funds to absorb the losses.');
            }
          }
        },
        {
          label: 'Ignore',
          effect: () => {
            gameState.chargebackRate = Math.min(100, gameState.chargebackRate + 10);
            addLog('Ignored chargebacks. Processor confidence deteriorates.');
          }
        }
      ]
    },
    {
      title: 'Bank Review',
      description: 'Your bank requests documents. Compliance is tested.',
      generateChoices: () => [
        {
          label: 'Provide Documents',
          effect: () => {
            if (gameState.compliance >= 60) {
              addLog('Documents accepted. Your account remains open.');
            } else {
              addLog('Compliance weak. Bank closes your account.');
              if (gameState.money > 0) {
                gameState.money = Math.floor(gameState.money * 0.5);
                addLog('Bank seized half of your funds.');
              }
            }
          }
        },
        {
          label: 'Delay',
          effect: () => {
            addLog('You delayed submitting documents. The bank grows suspicious.');
            gameState.compliance = Math.max(0, gameState.compliance - 5);
          }
        }
      ]
    },
    {
      title: 'Ad Account Ban',
      description: 'FaceSpace shuts down your ad campaigns.',
      generateChoices: () => [
        {
          label: 'Appeal',
          effect: () => {
            const success = Math.random() > 0.4;
            if (success) {
              addLog('Your ad account was reinstated.');
            } else {
              addLog('Appeal failed. You must diversify marketing.');
            }
          }
        },
        {
          label: 'Diversify Marketing',
          effect: () => {
            const cost = 10000;
            if (gameState.money >= cost) {
              gameState.money -= cost;
              const revenue = Math.floor(Math.random() * 8000) + 2000;
              gameState.money += revenue;
              addLog('Diversified marketing. New channels bring in revenue.');
            } else {
              addLog('Not enough funds to diversify marketing.');
            }
          }
        },
        {
          label: 'Accept',
          effect: () => {
            addLog('You accept the ban and wait it out.');
          }
        }
      ]
    },
    {
      title: 'Viral Video',
      description: 'A viral video features your product! Sales surge but your processor becomes nervous.',
      generateChoices: () => [
        {
          label: 'Ramp up Inventory',
          effect: () => {
            const cost = 20000;
            if (gameState.money >= cost) {
              gameState.money -= cost;
              gameState.inventory += 200;
              addLog('Inventory ramped up. You can handle the surge.');
            } else {
              addLog('Not enough funds to ramp inventory.');
            }
          }
        },
        {
          label: 'Take the Orders',
          effect: () => {
            const revenue = 50000;
            gameState.money += revenue;
            gameState.chargebackRate = Math.min(100, gameState.chargebackRate + 10);
            addLog('Orders taken. Huge profits but chargebacks loom.');
          }
        },
        {
          label: 'Pause Ads',
          effect: () => {
            addLog('You paused ads to control growth.');
          }
        }
      ]
    }
  ];

  // Achievements definitions. Each object contains a name, description and a
  // check function returning true when achieved.
  const achievements = [
    {
      key: 'btcForever',
      name: "THEY CAN'T SHUT OFF BITCOIN",
      description: 'Enable SOVPAY and survive 30 days.',
      check: () => gameState.sovPay && gameState.daysWithBitcoin >= 30
    },
    {
      key: 'firstShutdown',
      name: 'WE REGRET TO INFORM YOU',
      description: 'Lose your first processor.',
      check: () => gameState.processorShutdowns > 0
    },
    {
      key: 'sovereign',
      name: 'SOVEREIGN',
      description: 'Survive 365 days with Bitcoin, SOVPAY and alternative rails enabled.',
      check: () => gameState.day >= 365 && gameState.sovPay && gameState.altPay && gameState.sovSats
    },
    {
      key: 'jefe',
      name: 'THE JEFE',
      description: '$10 Million net worth with no processor shutdowns.',
      check: () => gameState.money >= 10000000 && gameState.processorShutdowns === 0
    }
  ];

  // Event logs to show messages to the player. For simplicity we log to the
  // console. Could be extended to show messages in the UI later.
  function addLog(message) {
    console.log(`[Day ${gameState.day}] ${message}`);
  }

  // Build the list of action buttons in the actions column.
  function buildActionButtons() {
    const actionsContainer = document.getElementById('actions');
    actions.forEach((action) => {
      const btn = document.createElement('button');
      btn.className = 'action-button';
      btn.textContent = action.label;
      btn.addEventListener('click', action.handler);
      actionsContainer.appendChild(btn);
    });
  }

  // Update the stats grid to reflect current game state.
  function updateStats() {
    document.getElementById('stat-day').textContent = gameState.day;
    document.getElementById('stat-money').textContent = gameState.money.toLocaleString();

    const grid = document.getElementById('stats-grid');
    // Clear previous
    grid.innerHTML = '';
    const stats = [
      { label: 'Employees', value: gameState.employees },
      { label: 'Inventory', value: gameState.inventory },
      { label: 'Stores', value: gameState.storeCount },
      { label: 'Processors', value: gameState.processors.length },
      { label: 'Backup Rails', value: gameState.backupRails ? 'Yes' : 'No' },
      { label: 'AltPay Nexus', value: gameState.altPay ? 'Yes' : 'No' },
      { label: 'SOVPAY', value: gameState.sovPay ? 'Yes' : 'No' },
      { label: 'SovSats', value: gameState.sovSats ? 'Yes' : 'No' },
      { label: 'Stash App', value: gameState.stashApp ? 'Yes' : 'No' },
      { label: 'Chargebacks', value: gameState.chargebackRate + '%' },
      { label: 'Compliance', value: gameState.compliance + '%' },
      { label: 'Legal Awareness', value: gameState.legalAwareness + '%' },
      { label: 'Processor Shutdowns', value: gameState.processorShutdowns }
    ];
    stats.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'stat-card';
      const label = document.createElement('span');
      label.className = 'label';
      label.textContent = item.label;
      const val = document.createElement('span');
      val.className = 'value';
      val.textContent = item.value;
      card.appendChild(label);
      card.appendChild(val);
      grid.appendChild(card);
    });
    updateAchievements();
  }

  // Update the achievements list in the dashboard. Checks which
  // achievements have been earned and marks them accordingly.
  function updateAchievements() {
    const list = document.getElementById('achievement-list');
    list.innerHTML = '';
    achievements.forEach((ach) => {
      const li = document.createElement('li');
      li.textContent = ach.name;
      // Check if earned
      if (!gameState.achievements[ach.key] && ach.check()) {
        gameState.achievements[ach.key] = true;
      }
      if (gameState.achievements[ach.key]) {
        li.classList.add('earned');
      }
      list.appendChild(li);
    });
  }

  // Show a random event if conditions meet. It selects one event and
  // displays its title, description and choices in a modal. Choices are
  // generated on demand because some events require randomised actions.
  function triggerRandomEvent() {
    const chance = Math.random();
    // 40% chance of random event each day
    if (chance < 0.4) {
      const event = randomEvents[Math.floor(Math.random() * randomEvents.length)];
      showEventModal(event);
    }
  }

  // Display an event modal with given event information.
  function showEventModal(event) {
    const overlay = document.getElementById('modal-overlay');
    const titleEl = document.getElementById('modal-title');
    const descEl = document.getElementById('modal-description');
    const choicesEl = document.getElementById('modal-choices');
    titleEl.textContent = event.title;
    descEl.textContent = event.description;
    choicesEl.innerHTML = '';
    const choices = event.generateChoices();
    choices.forEach((choice) => {
      const btn = document.createElement('button');
      btn.className = 'choice-button';
      btn.textContent = choice.label;
      btn.addEventListener('click', () => {
        choice.effect();
        overlay.classList.remove('active');
        updateStats();
      });
      choicesEl.appendChild(btn);
    });
    overlay.classList.add('active');
  }

  // Set up the start package selection overlay. Creates buttons for each
  // starting package that, when clicked, apply their values to gameState
  // and hide the overlay.
  function setupStartSelection() {
    const container = document.getElementById('start-options');
    startPackages.forEach((pack) => {
      const btn = document.createElement('button');
      btn.className = 'choice-button';
      btn.style.display = 'block';
      btn.style.width = '100%';
      btn.textContent = `${pack.name} – ${pack.description}`;
      btn.addEventListener('click', () => {
        // Apply starting values
        Object.assign(gameState, {
          money: pack.money,
          employees: pack.employees,
          inventory: pack.inventory,
          processors: [...pack.processors],
          backupRails: pack.backupRails,
          altPay: pack.altPay,
          sovPay: pack.sovPay,
          sovSats: pack.sovSats,
          stashApp: pack.stashApp,
          storeCount: pack.storeCount,
          compliance: pack.compliance,
          day: 1,
          chargebackRate: 0,
          legalAwareness: 0,
          processorShutdowns: 0,
          bitcoinEnabled: pack.sovPay,
          daysWithBitcoin: 0,
          achievements: {
            btcForever: false,
            firstShutdown: false,
            sovereign: false,
            jefe: false
          }
        });
        // Hide start overlay
        document.getElementById('start-overlay').style.display = 'none';
        updateStats();
      });
      container.appendChild(btn);
    });
  }

  // Process the next day: increment day, run daily simulation (sales and
  // expenses), update state, maybe trigger a random event and check
  // achievements.
  function processNextDay() {
    gameState.day += 1;
    // Daily sales: each day you sell up to 10 units if you have inventory
    const unitsSold = Math.min(10 * gameState.storeCount, gameState.inventory);
    const revenuePerUnit = 100;
    const revenue = unitsSold * revenuePerUnit;
    gameState.inventory -= unitsSold;
    gameState.money += revenue;
    // Employee salaries: each employee costs 100 per day
    const salary = gameState.employees * 100;
    gameState.money = Math.max(0, gameState.money - salary);
    // Update chargebacks: if ratio high and no alt rails, risk of shutdown
    if (gameState.chargebackRate > 20 && gameState.processors.length > 0 && Math.random() < gameState.chargebackRate / 100) {
      // Processor shutdown event triggered
      addLog('Your chargeback ratio triggered an unplanned processor shutdown.');
      // Remove first processor
      const removed = gameState.processors.shift();
      gameState.processorShutdowns += 1;
      addLog(`${removed} terminated your account due to chargebacks.`);
      updateStats();
    }
    // Compliance drifts down slowly over time
    gameState.compliance = Math.max(0, gameState.compliance - 0.5);
    // Increase days with bitcoin if enabled
    if (gameState.sovPay) {
      gameState.daysWithBitcoin += 1;
    }
    updateStats();
    triggerRandomEvent();
  }

  // Particle system for animated background. Creates a number of particles
  // with random positions, velocities and colours. Uses requestAnimationFrame
  // to draw each frame. Neon colours are selected from a palette.
  function startParticleSystem() {
    const canvas = document.getElementById('particle-canvas');
    const ctx = canvas.getContext('2d');
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    const numParticles = 80;
    const particles = [];
    const colours = ['#00ffff', '#ff00ff', '#ffa500', '#00c896'];
    function resetParticle(p) {
      p.x = Math.random() * width;
      p.y = Math.random() * height;
      p.vx = (Math.random() - 0.5) * 0.2;
      p.vy = (Math.random() - 0.5) * 0.2;
      p.radius = Math.random() * 2 + 1;
      p.color = colours[Math.floor(Math.random() * colours.length)];
    }
    for (let i = 0; i < numParticles; i++) {
      const p = {};
      resetParticle(p);
      particles.push(p);
    }
    function resize() {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    function draw() {
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        // wrap around edges
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;
        ctx.beginPath();
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 5);
        gradient.addColorStop(0, p.color);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.arc(p.x, p.y, p.radius * 5, 0, Math.PI * 2);
        ctx.fill();
      });
      requestAnimationFrame(draw);
    }
    draw();
  }

  // Register service worker if available
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/service-worker.js', { scope: '/' })
        .then((registration) => {
          console.log('Service worker registered:', registration.scope);
        })
        .catch((err) => {
          console.error('Service worker registration failed:', err);
        });
    }
  }

  // Initialise the game once the DOM is ready
  window.addEventListener('DOMContentLoaded', () => {
    setupStartSelection();
    buildActionButtons();
    updateStats();
    startParticleSystem();
    registerServiceWorker();
  });
})();