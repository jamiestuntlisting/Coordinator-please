import Phaser from 'phaser';
import GameStateManager from '../systems/GameStateManager';
import { VisitorGenerator } from '../systems/VisitorGenerator';
import { BookSystem } from '../systems/BookSystem';
import { ReelSystem } from '../systems/ReelSystem';
import { REEL_ANIMATIONS } from '../systems/ReelSystem';
import { ReputationSystem } from '../systems/ReputationSystem';
import { MoneySystem } from '../systems/MoneySystem';
import { NDUpgradeSystem } from '../systems/NDUpgradeSystem';
import { DocumentChecker } from '../systems/DocumentChecker';
import { NIGHT_CONFIGS } from '../config/nights';
import { BALANCE } from '../config/balance';
import type {
  NightConfig,
  Visitor,
  Role,
  RoleTemplate,
  BookListing,
  CoordListing,
  HireResult,
  HireOutcome,
  Injury,
  NightResult,
} from '../types/index';

// ============================================================
// Helpers
// ============================================================

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateRolesFromTemplates(templates: RoleTemplate[], nightNumber: number): Role[] {
  return templates.map((t, i) => ({
    id: `role_n${nightNumber}_${i}`,
    title: t.title,
    stuntType: t.stuntType,
    riskLevel: t.riskLevel,
    originalRiskLevel: t.riskLevel,
    wasUpgraded: false,
    requiredGender: t.requiredGender,
    heightRange: t.heightRange,
    weightRange: t.weightRange,
    requiredSkills: t.requiredSkills,
    sagRequired: t.sagRequired,
    filledBy: null,
  }));
}

// ============================================================
// DeskScene
// ============================================================

export class DeskScene extends Phaser.Scene {
  private nightConfig!: NightConfig;
  private gsm!: GameStateManager;
  private visitorGenerator!: VisitorGenerator;
  private bookSystem!: BookSystem;
  private reelSystem!: ReelSystem;
  private reputationSystem!: ReputationSystem;
  private moneySystem!: MoneySystem;
  private ndUpgradeSystem!: NDUpgradeSystem;
  private documentChecker!: DocumentChecker;

  private visitors: Visitor[] = [];
  private roles: Role[] = [];
  private bookListings: BookListing[] = [];
  private coordListings: CoordListing[] = [];
  private currentVisitorIndex: number = 0;
  private currentVisitor: Visitor | null = null;
  private night: number = 1;

  // UI containers
  private topHalfContainer!: Phaser.GameObjects.Container;
  private bottomHalfContainer!: Phaser.GameObjects.Container;
  private dialogueContainer!: Phaser.GameObjects.Container;
  private statusBar!: Phaser.GameObjects.Container;
  private overlayContainer!: Phaser.GameObjects.Container;
  private vhsOverlayContainer!: Phaser.GameObjects.Container;

  // State
  private hireResults: HireResult[] = [];
  private rejections: { visitorId: string; visitorName: string; wasFaker: boolean; wasReturning: boolean }[] = [];
  private bribesTaken: number = 0;
  private bribeMoney: number = 0;
  private nightDone: boolean = false;
  private idleTimer: number = 0;
  private idleThreshold: number = 5000;
  private thoughtBubble: Phaser.GameObjects.Container | null = null;
  private currentDialogueText: Phaser.GameObjects.Text | null = null;
  private bookResultText: Phaser.GameObjects.Text | null = null;
  private reelDisplayText: Phaser.GameObjects.Text | null = null;
  private bribeAccepted: boolean = false;
  private bribeRefused: boolean = false;
  private conversationHistory: { question: string; answer: string }[] = [];

  // Lie/tell tracking — what's wrong with this visitor
  private sagCardShown: boolean = false;
  private visitorTells: string[] = []; // tracked lies/tells found by the player
  private playerKnowsLie: boolean = false; // did the player catch a lie?

  // Real-time clock
  private clockElapsed: number = 0;
  private clockText: Phaser.GameObjects.Text | null = null;
  private statusTimeText: Phaser.GameObjects.Text | null = null;

  // Talking animation
  private isTalking: boolean = false;
  private talkElapsed: number = 0;
  private talkDuration: number = 1800; // ms of mouth movement
  private talkFrame: number = 0;
  private faceGfx: Phaser.GameObjects.Graphics | null = null;
  private talkExpression: 'neutral' | 'angry' | 'nervous' | 'smug' = 'neutral';
  private dialogueClickCounts: Record<string, number> = {};
  private reelAnimating: boolean = false;
  private reelAnimFrame: number = 0;
  private reelAnimElapsed: number = 0;
  private pendingReelVisitor: Visitor | null = null;

  // Intertitle
  private showingIntertitle: boolean = false;
  private intertitleContainer: Phaser.GameObjects.Container | null = null;
  // Visitor fade-in
  private visitorFadeIn: boolean = false;
  private visitorFadeElapsed: number = 0;
  private visitorFadeDuration: number = 800;
  private visitorSpriteContainer: Phaser.GameObjects.Container | null = null;

  // VHS effects
  private grainGraphics: Phaser.GameObjects.Graphics | null = null;
  private grainTimer: number = 0;
  private flickerTimer: number = 0;
  private flickerInterval: number = 0;
  private workLightGfx: Phaser.GameObjects.Graphics | null = null;
  private workLightBaseAlpha: number = 1;

  constructor() {
    super({ key: 'DeskScene' });
  }

  create(data: { night?: number; nightConfig?: NightConfig }): void {
    this.night = data.night ?? 1;
    this.nightConfig = data.nightConfig ?? NIGHT_CONFIGS[this.night - 1] ?? NIGHT_CONFIGS[0];
    this.gsm = GameStateManager.getInstance();

    // Instantiate systems
    this.visitorGenerator = new VisitorGenerator();
    this.bookSystem = new BookSystem();
    this.reelSystem = new ReelSystem();
    this.reputationSystem = new ReputationSystem();
    this.moneySystem = new MoneySystem();
    this.ndUpgradeSystem = new NDUpgradeSystem();
    this.documentChecker = new DocumentChecker();

    // Generate roles from nightConfig templates
    this.roles = generateRolesFromTemplates(this.nightConfig.roles, this.night);

    // Generate visitors using real VisitorGenerator
    const state = this.gsm.getCurrentState();
    this.visitors = this.visitorGenerator.generateVisitorsForNight(this.nightConfig, state);

    // Generate book using real BookSystem
    const bookData = this.bookSystem.generateBookForNight(this.visitors, this.nightConfig);
    this.bookListings = bookData.performers;
    this.coordListings = bookData.coordinators;

    // Reset per-night tracking
    this.currentVisitorIndex = 0;
    this.hireResults = [];
    this.rejections = [];
    this.bribesTaken = 0;
    this.bribeMoney = 0;
    this.nightDone = false;
    this.idleTimer = 0;
    this.thoughtBubble = null;
    this.currentDialogueText = null;
    this.bookResultText = null;
    this.reelDisplayText = null;
    this.bribeAccepted = false;
    this.bribeRefused = false;
    this.grainTimer = 0;
    this.flickerTimer = 0;
    this.flickerInterval = randomInt(5000, 10000);
    this.workLightGfx = null;
    this.showingIntertitle = false;
    this.intertitleContainer = null;
    this.visitorFadeIn = false;
    this.visitorFadeElapsed = 0;
    this.visitorSpriteContainer = null;
    this.reelAnimating = false;
    this.reelAnimFrame = 0;
    this.reelAnimElapsed = 0;
    this.pendingReelVisitor = null;
    this.clockElapsed = 0;
    this.clockText = null;
    this.statusTimeText = null;
    this.isTalking = false;
    this.talkElapsed = 0;
    this.talkFrame = 0;
    this.faceGfx = null;
    this.talkExpression = 'neutral';

    // Store in GameStateManager
    this.gsm.updateState({
      night: this.night,
      currentPhase: 'desk',
      roles: this.roles,
      visitors: this.visitors,
      stuntListingBook: this.bookListings,
      coordinatorListings: this.coordListings,
      reelPool: REEL_ANIMATIONS,
      currentVisitorIndex: 0,
      currentVisitor: null,
      timeOfNight: 18.0,
      sagRepVisited: false,
      ndUpgradeTriggered: false,
      ndUpgradeTarget: null,
    });

    this.cameras.main.setBackgroundColor('#050508');

    // Create containers (layered bottom to top)
    this.topHalfContainer = this.add.container(0, 0);
    this.bottomHalfContainer = this.add.container(0, 0);
    this.dialogueContainer = this.add.container(0, 0);
    this.statusBar = this.add.container(0, 0);
    this.overlayContainer = this.add.container(0, 0);
    this.vhsOverlayContainer = this.add.container(0, 0);

    this.drawTopHalf();
    this.drawStatusBar();
    this.drawVHSOverlay();
    this.showIntertitle();
  }

  update(_time: number, delta: number): void {
    if (this.nightDone) return;
    this.idleTimer += delta;

    // Film grain shimmer
    this.grainTimer += delta;
    if (this.grainTimer > 200) {
      this.grainTimer = 0;
      this.drawFilmGrain();
    }

    // Light flicker
    this.flickerTimer += delta;
    if (this.flickerTimer > this.flickerInterval) {
      this.flickerTimer = 0;
      this.flickerInterval = randomInt(5000, 10000);
      this.doLightFlicker();
    }

    // Visitor fade in from darkness
    if (this.visitorFadeIn && this.visitorSpriteContainer) {
      this.visitorFadeElapsed += delta;
      const progress = Math.min(1, this.visitorFadeElapsed / this.visitorFadeDuration);
      this.visitorSpriteContainer.setAlpha(progress);
      if (progress >= 1) {
        this.visitorFadeIn = false;
      }
    }

    // Talking animation — mouth moves, expression changes
    if (this.isTalking && this.faceGfx && this.currentVisitor) {
      this.talkElapsed += delta;
      const frameInterval = 120; // fast mouth movement
      if (this.talkElapsed > this.talkFrame * frameInterval) {
        this.talkFrame++;
        this.drawFaceExpression(this.talkFrame, this.talkExpression);
      }
      if (this.talkElapsed >= this.talkDuration) {
        this.isTalking = false;
        // Draw resting face
        this.drawFaceExpression(-1, 'neutral');
      }
    }

    // Real-time clock — tick up every 1.5 seconds of real time = 1 minute game time (2x speed)
    this.clockElapsed += delta;
    if (this.clockElapsed >= 1500) {
      this.clockElapsed = 0;
      const state = this.gsm.getCurrentState();
      const newTime = state.timeOfNight + (1 / 60); // +1 minute
      this.gsm.updateState({ timeOfNight: newTime });
      // Update displays
      const timeStr = this.formatTime(newTime);
      if (this.clockText) this.clockText.setText(timeStr);
      if (this.statusTimeText) this.statusTimeText.setText(timeStr);

      // Check deadline
      if (newTime >= this.nightConfig.hiringDeadline && !this.nightDone) {
        this.endNight();
      }
    }

    // Reel animation — animate the stick figure performing the stunt
    if (this.reelAnimating && this.reelDisplayText) {
      this.reelAnimElapsed += delta;
      if (this.reelAnimElapsed > 200) {
        this.reelAnimElapsed = 0;
        this.reelAnimFrame++;
        const dots = '.'.repeat((this.reelAnimFrame % 3) + 1);
        this.reelDisplayText.setText(`▶ PLAYING${dots}`);

        // Draw animated frame in monitor
        if (this.pendingReelVisitor?.skillReel) {
          const animation = REEL_ANIMATIONS.find(a => a.id === this.pendingReelVisitor!.skillReel!.animationId);
          const animType = animation ? animation.stuntType : 'unknown';
          this.drawReelAnimFrame(animType, this.reelAnimFrame);
        }

        if (this.reelAnimFrame >= 10) {
          this.reelAnimating = false;
          this.showReelResult();
        }
      }
    }
  }

  // ================================================================
  // TOP HALF: The Dark Film Set (y: 0-380)
  // ================================================================

  private drawTopHalf(): void {
    this.topHalfContainer.removeAll(true);

    // --- Night Sky Gradient ---
    const skyGfx = this.add.graphics();
    this.topHalfContainer.add(skyGfx);

    const skyColors = [
      0x0a0a1a, 0x09091a, 0x080818, 0x070716,
      0x060614, 0x060613, 0x050512, 0x050511,
      0x050510, 0x05050e, 0x05050c, 0x05050b,
      0x05050a, 0x050509, 0x050508, 0x050508,
    ];
    const stripH = 24;
    for (let i = 0; i < skyColors.length; i++) {
      skyGfx.fillStyle(skyColors[i], 1);
      skyGfx.fillRect(0, i * stripH, 800, stripH);
    }

    // --- Stars ---
    const starGfx = this.add.graphics();
    this.topHalfContainer.add(starGfx);
    const starPositions = [
      { x: 45, y: 12 }, { x: 120, y: 28 }, { x: 210, y: 8 }, { x: 280, y: 45 },
      { x: 350, y: 18 }, { x: 420, y: 35 }, { x: 510, y: 10 }, { x: 580, y: 42 },
      { x: 650, y: 15 }, { x: 720, y: 30 }, { x: 90, y: 55 }, { x: 180, y: 70 },
      { x: 340, y: 65 }, { x: 470, y: 58 }, { x: 600, y: 72 }, { x: 740, y: 60 },
      { x: 50, y: 85 }, { x: 300, y: 90 }, { x: 555, y: 82 },
      { x: 70, y: 110 }, { x: 200, y: 130 }, { x: 400, y: 115 },
      { x: 550, y: 125 }, { x: 700, y: 100 }, { x: 150, y: 150 },
    ];
    starPositions.forEach(s => {
      const alpha = 0.2 + Math.random() * 0.5;
      const size = Math.random() > 0.7 ? 2 : 1;
      starGfx.fillStyle(0xccccdd, alpha);
      starGfx.fillRect(s.x, s.y, size, size);
    });

    // --- Crescent Moon ---
    const moonGfx = this.add.graphics();
    this.topHalfContainer.add(moonGfx);
    moonGfx.fillStyle(0xd4cdb0, 0.25);
    moonGfx.fillCircle(730, 30, 12);
    moonGfx.fillStyle(0x0a0a1a, 1);
    moonGfx.fillCircle(725, 27, 11);

    // --- Ground / Lot surface ---
    const groundGfx = this.add.graphics();
    this.topHalfContainer.add(groundGfx);
    groundGfx.fillStyle(0x151518, 1);
    groundGfx.fillRect(0, 320, 800, 60);
    // pavement cracks
    groundGfx.lineStyle(1, 0x1c1c20, 0.4);
    groundGfx.lineBetween(0, 335, 800, 335);
    groundGfx.lineBetween(0, 352, 800, 352);
    groundGfx.lineBetween(0, 368, 800, 368);
    groundGfx.lineStyle(1, 0x1a1a1e, 0.25);
    groundGfx.lineBetween(100, 340, 250, 342);
    groundGfx.lineBetween(500, 356, 700, 355);
    groundGfx.lineBetween(300, 365, 480, 367);

    // --- Equipment Silhouettes ---
    const equipGfx = this.add.graphics();
    this.topHalfContainer.add(equipGfx);
    const eShadow = 0x0d0d14;
    const eDark = 0x101020;

    // C-STAND (left) - vertical pole, horizontal arm, flag/scrim, triangular base with 3 legs
    equipGfx.fillStyle(eShadow, 1);
    equipGfx.fillRect(52, 108, 3, 212);         // vertical pole
    equipGfx.fillRect(40, 108, 30, 3);          // horizontal arm
    equipGfx.fillStyle(eDark, 1);
    equipGfx.fillRect(30, 88, 25, 22);          // flag/scrim rectangle
    // triangular base: 3 legs
    equipGfx.fillStyle(eShadow, 1);
    equipGfx.fillRect(35, 318, 35, 3);          // base bar
    equipGfx.fillRect(53, 318, 2, 5);
    equipGfx.beginPath();
    equipGfx.moveTo(53, 320);
    equipGfx.lineTo(35, 323);
    equipGfx.lineTo(71, 323);
    equipGfx.closePath();
    equipGfx.fillPath();

    // FILM LIGHT ON STAND (left-center) - tall pole, rectangular housing with barn doors, cable
    equipGfx.fillStyle(eShadow, 1);
    equipGfx.fillRect(155, 82, 3, 238);         // tall vertical pole
    equipGfx.fillStyle(eDark, 1);
    equipGfx.fillRect(140, 65, 30, 22);         // light housing
    // barn doors (small rectangles on each side)
    equipGfx.fillStyle(0x141420, 1);
    equipGfx.fillRect(137, 65, 5, 18);          // left barn door
    equipGfx.fillRect(168, 65, 5, 18);          // right barn door
    // cable drooping down
    equipGfx.lineStyle(1, eShadow, 0.7);
    equipGfx.beginPath();
    equipGfx.moveTo(155, 89);
    equipGfx.lineTo(140, 135);
    equipGfx.lineTo(130, 200);
    equipGfx.lineTo(125, 320);
    equipGfx.strokePath();
    // stand base
    equipGfx.fillStyle(eShadow, 1);
    equipGfx.fillRect(140, 318, 30, 3);
    equipGfx.beginPath();
    equipGfx.moveTo(156, 320);
    equipGfx.lineTo(140, 323);
    equipGfx.lineTo(170, 323);
    equipGfx.closePath();
    equipGfx.fillPath();

    // CAMERA ON TRIPOD (right) - box on triangular legs with viewfinder
    equipGfx.fillStyle(eDark, 1);
    equipGfx.fillRect(650, 176, 40, 28);        // camera body
    equipGfx.fillStyle(eShadow, 1);
    equipGfx.fillRect(645, 181, 8, 8);          // viewfinder
    equipGfx.fillRect(690, 178, 10, 6);         // lens shade
    // tripod legs
    equipGfx.lineStyle(2, eShadow, 0.9);
    equipGfx.lineBetween(660, 204, 640, 320);   // left leg
    equipGfx.lineBetween(670, 204, 670, 320);   // center leg
    equipGfx.lineBetween(680, 204, 700, 320);   // right leg

    // APPLE BOXES stacked (far right)
    equipGfx.fillStyle(0x12121c, 1);
    equipGfx.fillRect(740, 290, 40, 22);        // bottom box
    equipGfx.fillStyle(0x101018, 1);
    equipGfx.fillRect(742, 270, 36, 22);        // middle box
    equipGfx.fillStyle(0x0e0e16, 1);
    equipGfx.fillRect(745, 254, 30, 18);        // top box

    // GENERATOR (far left edge) - large rectangle with exhaust pipe
    equipGfx.fillStyle(0x0e0e16, 1);
    equipGfx.fillRect(0, 280, 28, 40);          // generator body
    equipGfx.fillStyle(eShadow, 1);
    equipGfx.fillRect(5, 268, 4, 14);           // exhaust pipe
    // subtle warm glow around generator
    const genGlow = this.add.graphics();
    this.topHalfContainer.add(genGlow);
    genGlow.fillStyle(0xf5a030, 0.015);
    genGlow.fillCircle(14, 295, 40);
    genGlow.fillStyle(0xf5a030, 0.025);
    genGlow.fillCircle(14, 295, 22);

    // --- Work Light Glow (center, where the desk is) ---
    this.workLightGfx = this.add.graphics();
    this.topHalfContainer.add(this.workLightGfx);
    this.drawWorkLightGlow(1.0);

    // --- The Coordinator (center, behind the desk) ---
    this.drawCoordinator();

    // --- The folding table ---
    this.drawFoldingTable();

    // --- Queue silhouettes ---
    this.drawQueueFigures();

    // --- Time display ---
    this.drawTimeDisplay();

    // --- Call Sheet button (top-left) ---
    this.drawCallSheetButton();
  }

  private showIntertitle(): void {
    this.showingIntertitle = true;
    this.intertitleContainer = this.add.container(0, 0);
    this.intertitleContainer.setDepth(50);

    const gfx = this.add.graphics();
    this.intertitleContainer.add(gfx);
    gfx.fillStyle(0x050508, 1);
    gfx.fillRect(0, 0, 800, 900);

    // Subtle work light glow hint
    gfx.fillStyle(0xf5d799, 0.03);
    gfx.fillEllipse(400, 400, 300, 200);

    const titleText = this.add.text(400, 380, 'A few stunties are\nhere to hustle you.', {
      fontFamily: 'Courier New, monospace',
      fontSize: '28px',
      color: '#d4c5a0',
      align: 'center',
      lineSpacing: 8,
    }).setOrigin(0.5);
    this.intertitleContainer.add(titleText);

    const continueText = this.add.text(400, 500, '[ TAP TO CONTINUE ]', {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      color: '#6a6050',
    }).setOrigin(0.5);
    this.intertitleContainer.add(continueText);

    // Use pointerdown to dismiss
    this.input.once('pointerdown', () => {
      if (this.intertitleContainer) {
        this.intertitleContainer.destroy();
        this.intertitleContainer = null;
      }
      this.showingIntertitle = false;
      this.presentVisitor(this.visitors[0]);
    });
  }

  private drawWorkLightGlow(alphaMultiplier: number): void {
    if (!this.workLightGfx) return;
    this.workLightGfx.clear();

    const cx = 400;
    const cy = 350;
    // concentric ellipses, warm center to cooler edges
    const glowLayers = [
      { rx: 260, ry: 110, color: 0xe8d0a0, alpha: 0.018 },
      { rx: 220, ry: 95, color: 0xecd3a2, alpha: 0.025 },
      { rx: 180, ry: 80, color: 0xf0d898, alpha: 0.032 },
      { rx: 140, ry: 65, color: 0xf2da96, alpha: 0.04 },
      { rx: 110, ry: 52, color: 0xf4d894, alpha: 0.05 },
      { rx: 80, ry: 40, color: 0xf5d799, alpha: 0.06 },
      { rx: 55, ry: 28, color: 0xf5d799, alpha: 0.07 },
      { rx: 30, ry: 16, color: 0xf8e0a0, alpha: 0.08 },
    ];
    glowLayers.forEach(layer => {
      this.workLightGfx!.fillStyle(layer.color, layer.alpha * alphaMultiplier);
      this.workLightGfx!.fillEllipse(cx, cy, layer.rx * 2, layer.ry * 2);
    });

    // Light spill on the ground surface
    this.workLightGfx!.fillStyle(0xf5d799, 0.015 * alphaMultiplier);
    this.workLightGfx!.fillEllipse(cx, 360, 320, 30);
  }

  private drawCoordinator(): void {
    const gfx = this.add.graphics();
    this.topHalfContainer.add(gfx);

    const cx = 400;
    const chairY = 265;

    // Folding chair - seat + back + thin metal legs (scaled up)
    gfx.fillStyle(0x222228, 1);
    gfx.fillRect(cx - 24, chairY + 42, 48, 8);     // seat
    gfx.fillRect(cx - 22, chairY + 7, 5, 36);       // back left
    gfx.fillRect(cx + 17, chairY + 7, 5, 36);       // back right
    gfx.fillRect(cx - 22, chairY, 44, 7);            // back panel
    // chair legs
    gfx.lineStyle(1, 0x333340, 0.8);
    gfx.lineBetween(cx - 22, chairY + 50, cx - 28, chairY + 72);
    gfx.lineBetween(cx + 22, chairY + 50, cx + 28, chairY + 72);
    gfx.lineBetween(cx - 14, chairY + 50, cx - 8, chairY + 72);
    gfx.lineBetween(cx + 14, chairY + 50, cx + 8, chairY + 72);

    // Body - dark jacket (scaled up)
    gfx.fillStyle(0x2a2830, 1);
    gfx.fillRect(cx - 22, chairY + 7, 44, 42);      // torso
    // shoulders wider
    gfx.fillRect(cx - 28, chairY + 7, 56, 11);

    // Arms on table surface
    gfx.fillStyle(0xc4a882, 1);
    gfx.fillRect(cx - 34, chairY + 44, 19, 8);      // left arm
    gfx.fillRect(cx + 15, chairY + 44, 19, 8);      // right arm

    // Head (radius 14 instead of 10-ish)
    gfx.fillStyle(0xc4a882, 1);
    gfx.fillRoundedRect(cx - 13, chairY - 25, 26, 28, 7);

    // SUNGLASSES - big, dark, iconic (scaled up)
    gfx.fillStyle(0x0a0a0e, 1);
    gfx.fillRect(cx - 12, chairY - 17, 11, 7);        // left lens
    gfx.fillRect(cx + 1, chairY - 17, 11, 7);         // right lens
    gfx.fillRect(cx - 1, chairY - 15, 2, 4);         // bridge
    // arms of glasses
    gfx.lineStyle(1, 0x0a0a0e, 1);
    gfx.lineBetween(cx - 12, chairY - 14, cx - 16, chairY - 11);
    gfx.lineBetween(cx + 12, chairY - 14, cx + 16, chairY - 11);

    // HAT - "GENERIC STUNT TEAM" baseball cap (scaled up)
    gfx.fillStyle(0x2a3a5a, 1);
    // dome of cap
    gfx.fillRoundedRect(cx - 15, chairY - 37, 30, 16, 5);
    // brim
    gfx.fillStyle(0x243254, 1);
    gfx.fillRect(cx - 19, chairY - 23, 27, 5);
    // GST text on cap
    const gstText = this.add.text(cx - 8, chairY - 35, 'GST', {
      fontFamily: 'Courier New, monospace',
      fontSize: '8px',
      color: '#8090b0',
    });
    this.topHalfContainer.add(gstText);
  }

  private drawFoldingTable(): void {
    const gfx = this.add.graphics();
    this.topHalfContainer.add(gfx);

    const tx = 270;
    const ty = 340;
    const tw = 260;
    const th = 8;

    // Table surface - slightly lighter where light hits
    gfx.fillStyle(0x1e1e2a, 1);
    gfx.fillRect(tx, ty, tw, th);
    // light highlight on center of table
    gfx.fillStyle(0xf5d799, 0.04);
    gfx.fillRect(tx + 60, ty, 80, th);

    // Metal folding legs underneath
    gfx.lineStyle(2, 0x2a2a36, 0.8);
    gfx.lineBetween(tx + 20, ty + th, tx + 10, ty + 30);
    gfx.lineBetween(tx + 40, ty + th, tx + 30, ty + 30);
    gfx.lineBetween(tx + tw - 20, ty + th, tx + tw - 10, ty + 30);
    gfx.lineBetween(tx + tw - 40, ty + th, tx + tw - 30, ty + 30);
    // cross braces
    gfx.lineStyle(1, 0x222230, 0.5);
    gfx.lineBetween(tx + 15, ty + 20, tx + 35, ty + 20);
    gfx.lineBetween(tx + tw - 35, ty + 20, tx + tw - 15, ty + 20);

    // Items ON the table:
    // Papers/headshots (left side)
    gfx.fillStyle(0xd8d0c0, 0.6);
    gfx.fillRect(tx + 10, ty - 2, 24, 16);
    gfx.fillStyle(0xc8c0b0, 0.5);
    gfx.fillRect(tx + 12, ty - 1, 24, 16);

    // Coffee cup (right side)
    gfx.fillStyle(0x3a3a44, 1);
    gfx.fillRect(tx + tw - 35, ty - 6, 12, 10);
    gfx.fillStyle(0x2a2a32, 1);
    gfx.fillRect(tx + tw - 37, ty - 6, 16, 3);     // rim
    // steam lines
    gfx.lineStyle(1, 0x888888, 0.2);
    gfx.beginPath();
    gfx.moveTo(tx + tw - 32, ty - 8);
    gfx.lineTo(tx + tw - 34, ty - 14);
    gfx.lineTo(tx + tw - 30, ty - 18);
    gfx.strokePath();
    gfx.beginPath();
    gfx.moveTo(tx + tw - 27, ty - 8);
    gfx.lineTo(tx + tw - 29, ty - 13);
    gfx.lineTo(tx + tw - 25, ty - 17);
    gfx.strokePath();

    // Clamp work light (on the table edge, center-right)
    gfx.fillStyle(0x444450, 1);
    gfx.fillRect(tx + tw - 60, ty - 10, 10, 10);    // light housing
    gfx.fillStyle(0xf5d799, 0.3);
    gfx.fillCircle(tx + tw - 55, ty - 5, 4);        // bulb glow
    gfx.fillStyle(0x333340, 1);
    gfx.fillRect(tx + tw - 58, ty, 6, 4);            // clamp
  }

  private drawQueueFigures(): void {
    const queueCount = Math.max(0, this.visitors.length - this.currentVisitorIndex - 1);
    if (queueCount === 0) return;

    const gfx = this.add.graphics();
    this.topHalfContainer.add(gfx);

    const figCount = Math.min(queueCount, 12);
    for (let i = 0; i < figCount; i++) {
      // Use a seeded offset per index for consistent randomness across redraws
      const seed = (i * 7 + 13) % 17;
      const heightVar = ((seed % 7) - 3);       // -3 to +3
      const posJitterX = ((seed * 3) % 5) - 2;  // -2 to +2
      const posJitterY = ((seed * 5) % 5) - 2;  // -2 to +2

      let qx: number, qy: number, scale: number, alpha: number;

      if (i < 5) {
        // Front group: roughly where they were, staggered left side
        qx = 80 + i * 28 + posJitterX;
        qy = 220 - i * 8 + posJitterY;
        scale = 1.0 - i * 0.02;
        alpha = 0.9 - i * 0.12;
      } else if (i < 8) {
        // Middle group: curving further left, smaller, more transparent
        const mi = i - 5;
        qx = 60 - mi * 22 + posJitterX;
        qy = 190 - mi * 12 + posJitterY;
        scale = 0.82 - mi * 0.06;
        alpha = 0.35 - mi * 0.07;
      } else {
        // Far group: very small, very dim, suggesting line extends off-screen
        const fi = i - 8;
        qx = 10 - fi * 18 + posJitterX;
        qy = 165 - fi * 8 + posJitterY;
        scale = 0.6 - fi * 0.06;
        alpha = 0.15 - fi * 0.03;
      }

      alpha = Math.max(0.04, alpha);
      scale = Math.max(0.4, scale);

      const bodyW = Math.round(16 * scale);
      const bodyH = Math.round(42 * scale);
      const headR = Math.round(7 * scale);
      const legW = Math.round(5 * scale);
      const legH = Math.round(16 * scale);

      // Body rectangle
      gfx.fillStyle(0x16161e, alpha);
      gfx.fillRect(qx - bodyW / 2, qy + heightVar, bodyW, bodyH);
      // Head circle
      gfx.fillCircle(qx, qy - headR - 1 + heightVar, headR);
      // Legs (two thin rects)
      gfx.fillRect(qx - bodyW / 2 + 1, qy + bodyH + heightVar, legW, legH);
      gfx.fillRect(qx + 1, qy + bodyH + heightVar, legW, legH);
    }
  }

  private drawTimeDisplay(): void {
    const state = this.gsm.getCurrentState();
    const timeStr = this.formatTime(state.timeOfNight);
    const deadlineStr = this.formatTime(this.nightConfig.hiringDeadline);

    // Dark panel behind time
    const panelGfx = this.add.graphics();
    this.topHalfContainer.add(panelGfx);
    panelGfx.fillStyle(0x0a0a12, 0.7);
    panelGfx.fillRoundedRect(620, 6, 170, 26, 4);
    panelGfx.lineStyle(1, 0x2a2a36, 0.5);
    panelGfx.strokeRoundedRect(620, 6, 170, 26, 4);

    this.clockText = this.add.text(660, 12, timeStr, {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      color: '#a09880',
    }).setOrigin(0.5, 0);
    this.topHalfContainer.add(this.clockText);

    // Deadline indicator
    const deadlineLabel = this.add.text(750, 12, `DL: ${deadlineStr}`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '12px',
      color: '#c4553a',
    }).setOrigin(0.5, 0);
    this.topHalfContainer.add(deadlineLabel);
  }

  private drawCallSheetButton(): void {
    const cbGfx = this.add.graphics();
    this.topHalfContainer.add(cbGfx);

    // Call sheet button — large, easy to tap on mobile
    const bx = 10;
    const by = 6;
    const bw = 120;
    const bh = 50;

    cbGfx.fillStyle(0x1a1816, 0.9);
    cbGfx.fillRoundedRect(bx, by, bw, bh, 6);
    cbGfx.lineStyle(1, 0x5a4a2a, 0.8);
    cbGfx.strokeRoundedRect(bx, by, bw, bh, 6);

    // Clipboard icon
    cbGfx.fillStyle(0x6a5a3a, 0.8);
    cbGfx.fillRect(bx + 8, by + 10, 18, 28);
    cbGfx.fillStyle(0xd4c5a0, 0.4);
    cbGfx.fillRect(bx + 11, by + 15, 12, 1);
    cbGfx.fillRect(bx + 11, by + 19, 12, 1);
    cbGfx.fillRect(bx + 11, by + 23, 10, 1);
    cbGfx.fillRect(bx + 11, by + 27, 12, 1);
    // Clip
    cbGfx.fillStyle(0x8a7a5a, 0.9);
    cbGfx.fillRect(bx + 13, by + 6, 8, 5);

    const cbText = this.add.text(bx + 34, by + 8, 'CALL\nSHEET', {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      color: '#e8c36a',
      fontStyle: 'bold',
      lineSpacing: 2,
    });
    this.topHalfContainer.add(cbText);

    const cbZone = this.add.zone(bx + bw / 2, by + bh / 2, bw, bh)
      .setInteractive({ useHandCursor: true });
    this.topHalfContainer.add(cbZone);
    cbZone.on('pointerdown', () => {
      this.showCallSheetOverlay();
    });
  }

  private showSagRepEncounter(_visitor: Visitor): void {
    this.overlayContainer.removeAll(true);
    const gfx = this.add.graphics();
    this.overlayContainer.add(gfx);

    // Dark overlay
    gfx.fillStyle(0x0a0a0f, 0.95);
    gfx.fillRoundedRect(60, 150, 680, 500, 8);
    gfx.lineStyle(2, 0x2a4a8a, 0.8);
    gfx.strokeRoundedRect(60, 150, 680, 500, 8);

    // SAG logo bar
    gfx.fillStyle(0x2a4a8a, 1);
    gfx.fillRect(80, 165, 640, 40);

    const sagLogo = this.add.text(400, 185, 'SCREEN ACTORS GUILD', {
      fontFamily: 'Courier New, monospace',
      fontSize: '22px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.overlayContainer.add(sagLogo);

    // Rep portrait — suited figure
    const repGfx = this.add.graphics();
    this.overlayContainer.add(repGfx);
    repGfx.fillStyle(0x2a2a3a, 1);
    repGfx.fillRect(370, 220, 60, 70); // suit
    repGfx.fillStyle(0xc4a882, 0.9);
    repGfx.fillCircle(400, 235, 18); // head
    repGfx.fillStyle(0x1a1a2a, 1);
    repGfx.fillRect(388, 230, 10, 5); // glasses left
    repGfx.fillRect(402, 230, 10, 5); // glasses right
    repGfx.fillRect(398, 232, 4, 2); // bridge

    // Dialogue
    const dialogue = this.add.text(400, 310, '"Good evening. I\'m from the Guild.\nWe\'ve had reports of non-union\nperformers on SAG sets.\n\nA contribution to the safety fund\nwould go a long way toward resolving\nany... concerns."', {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      color: '#d4c5a0',
      align: 'center',
      lineSpacing: 4,
    }).setOrigin(0.5, 0);
    this.overlayContainer.add(dialogue);

    const sagCost = BALANCE.sagRepCost;

    // PAY button
    const payBg = this.add.graphics();
    this.overlayContainer.add(payBg);
    payBg.fillStyle(0x1a3a1e, 1);
    payBg.fillRoundedRect(100, 530, 280, 44, 6);
    payBg.lineStyle(2, 0x4a7a4f, 1);
    payBg.strokeRoundedRect(100, 530, 280, 44, 6);

    const payBtn = this.add.text(240, 552, `PAY $${sagCost}`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '22px',
      color: '#6aba6f',
      fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.overlayContainer.add(payBtn);

    payBtn.on('pointerdown', () => {
      const state = this.gsm.getCurrentState();
      this.gsm.updateState({
        sagRepVisited: true,
        money: state.money - sagCost,
      });
      this.overlayContainer.removeAll(true);
      this.drawStatusBar();
      this.nextVisitor();
    });

    // REFUSE button
    const refBg = this.add.graphics();
    this.overlayContainer.add(refBg);
    refBg.fillStyle(0x3a1a1a, 1);
    refBg.fillRoundedRect(420, 530, 280, 44, 6);
    refBg.lineStyle(2, 0xc4553a, 1);
    refBg.strokeRoundedRect(420, 530, 280, 44, 6);

    const refBtn = this.add.text(560, 552, 'REFUSE', {
      fontFamily: 'Courier New, monospace',
      fontSize: '22px',
      color: '#e06050',
      fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.overlayContainer.add(refBtn);

    refBtn.on('pointerdown', () => {
      // Refusing the SAG rep costs you a mistake
      const state = this.gsm.getCurrentState();
      this.gsm.updateState({
        sagRepVisited: true,
        strikes: state.strikes + 1,
      });

      // Show threat
      const threatGfx = this.add.graphics();
      this.overlayContainer.add(threatGfx);
      threatGfx.fillStyle(0x0a0a0f, 0.95);
      threatGfx.fillRoundedRect(120, 480, 560, 80, 6);
      threatGfx.lineStyle(1, 0xc4553a, 0.8);
      threatGfx.strokeRoundedRect(120, 480, 560, 80, 6);

      const threat = this.add.text(400, 520, '"That\'s your choice. But we\'ll be watching\nvery closely from now on."', {
        fontFamily: 'Courier New, monospace',
        fontSize: '16px',
        color: '#c4553a',
        align: 'center',
        fontStyle: 'italic',
      }).setOrigin(0.5);
      this.overlayContainer.add(threat);

      // Auto-dismiss after 1.5s
      this.time.delayedCall(1500, () => {
        this.overlayContainer.removeAll(true);
        this.drawStatusBar();
        this.nextVisitor();
      });
    });

    // Warning text
    const warning = this.add.text(400, 595, 'Refusing may result in a mistake.', {
      fontFamily: 'Courier New, monospace',
      fontSize: '13px',
      color: '#6a6050',
    }).setOrigin(0.5);
    this.overlayContainer.add(warning);
  }

  private showCallSheetOverlay(): void {
    this.overlayContainer.removeAll(true);

    const gfx = this.add.graphics();
    this.overlayContainer.add(gfx);

    // Full overlay
    gfx.fillStyle(0x0a0a0f, 0.95);
    gfx.fillRoundedRect(30, 30, 740, 830, 6);
    gfx.lineStyle(2, 0x4a453e, 0.8);
    gfx.strokeRoundedRect(30, 30, 740, 830, 6);

    // Paper texture
    gfx.fillStyle(0x1e1c18, 1);
    gfx.fillRect(40, 40, 720, 810);

    // Set high depth so it covers everything (SAG card, etc)
    this.overlayContainer.setDepth(100);

    // Title
    const csTitle = this.add.text(400, 65, `CALL SHEET — NIGHT ${this.night}`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '24px',
      color: '#d4c5a0',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.overlayContainer.add(csTitle);

    // Location & date — spaced down more
    const locText = this.add.text(70, 100, `LOCATION: Localville`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      color: '#888070',
    });
    this.overlayContainer.add(locText);

    const dateText = this.add.text(730, 100, `March ${14 + this.night}, 1995`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      color: '#888070',
    }).setOrigin(1, 0);
    this.overlayContainer.add(dateText);

    // Deadline — spaced down
    const deadlineStr = this.formatTime(this.nightConfig.hiringDeadline);
    const dlText = this.add.text(400, 130, `MUST HIRE BY: ${deadlineStr}`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '20px',
      color: '#e8c36a',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.overlayContainer.add(dlText);

    // Separator — lower
    gfx.lineStyle(1, 0x3a352e, 0.8);
    gfx.lineBetween(60, 160, 740, 160);

    // Roles — start lower
    let ry = 172;
    this.roles.forEach((role) => {
      const isFilled = role.filledBy !== null;
      const heightStr = `${Math.floor(role.heightRange[0] / 12)}'${role.heightRange[0] % 12}"-${Math.floor(role.heightRange[1] / 12)}'${role.heightRange[1] % 12}"`;
      const weightStr = `${role.weightRange[0]}-${role.weightRange[1]} lbs`;
      const genderReq = role.requiredGender === 'any' ? 'ANY' : role.requiredGender.toUpperCase();
      const riskColors: Record<string, string> = { high: '#c4553a', medium: '#e8c36a', nd: '#4a7a4f' };

      // Row bg
      gfx.fillStyle(isFilled ? 0x1a2a1a : 0x141210, 0.5);
      gfx.fillRoundedRect(55, ry, 690, 70, 3);

      const titleText = this.add.text(75, ry + 6, role.title, {
        fontFamily: 'Courier New, monospace',
        fontSize: '22px',
        color: '#d4c5a0',
        fontStyle: 'bold',
      });
      this.overlayContainer.add(titleText);

      const riskText = this.add.text(75, ry + 32, `${role.riskLevel.toUpperCase()}  ${genderReq}  ${heightStr}  ${weightStr}`, {
        fontFamily: 'Courier New, monospace',
        fontSize: '14px',
        color: riskColors[role.riskLevel] ?? '#888070',
      });
      this.overlayContainer.add(riskText);

      if (role.requiredSkills.length > 0) {
        const skillsText = this.add.text(75, ry + 50, `Skills: ${role.requiredSkills.map(s => s.replace(/_/g, ' ')).join(', ')}`, {
          fontFamily: 'Courier New, monospace',
          fontSize: '13px',
          color: '#6a9a6e',
        });
        this.overlayContainer.add(skillsText);
      }

      // Status
      const statusLabel = isFilled ? 'FILLED' : 'OPEN';
      const statusColor = isFilled ? '#4a7a4f' : '#e8c36a';
      const statusText = this.add.text(720, ry + 10, statusLabel, {
        fontFamily: 'Courier New, monospace',
        fontSize: '18px',
        color: statusColor,
        fontStyle: 'bold',
      }).setOrigin(1, 0);
      this.overlayContainer.add(statusText);

      // SAG badge
      if (role.sagRequired) {
        const sagText = this.add.text(720, ry + 34, 'SAG REQ', {
          fontFamily: 'Courier New, monospace',
          fontSize: '12px',
          color: '#c4553a',
          fontStyle: 'bold',
        }).setOrigin(1, 0);
        this.overlayContainer.add(sagText);
      }

      ry += 78;
    });

    // Close button
    const closeBg = this.add.graphics();
    this.overlayContainer.add(closeBg);
    closeBg.fillStyle(0x2a2618, 1);
    closeBg.fillRoundedRect(340, ry + 10, 120, 36, 5);
    closeBg.lineStyle(1, 0x5a4a2a, 1);
    closeBg.strokeRoundedRect(340, ry + 10, 120, 36, 5);

    const closeBtn = this.add.text(400, ry + 22, 'CLOSE', {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: '#e8c36a',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    this.overlayContainer.add(closeBtn);

    closeBtn.on('pointerdown', () => {
      this.overlayContainer.removeAll(true);
    });
  }

  // ---- Visitor sprite ----
  private drawCurrentVisitorSprite(): void {
    if (!this.currentVisitor) return;

    this.visitorSpriteContainer = this.add.container(0, 0);
    this.topHalfContainer.add(this.visitorSpriteContainer);
    this.visitorSpriteContainer.setAlpha(0);
    this.visitorFadeIn = true;
    this.visitorFadeElapsed = 0;

    const gfx = this.add.graphics();
    this.visitorSpriteContainer.add(gfx);

    const vx = 400;
    const vy = 160;
    const s = 4.0; // scale factor
    const isMale = this.currentVisitor.gender === 'male';
    const app = this.currentVisitor.appearance;
    const bodyColor = app.shirtColor;
    const skinColor = app.skinTone;
    const skinShadow = app.skinShadow;
    const hairColor = app.hairColor;

    // Shadow on ground
    gfx.fillStyle(0x000000, 0.25);
    gfx.fillEllipse(vx, vy + 76*s, 40*s, 12*s);

    // Shoes
    gfx.fillStyle(0x1a1a22, 1);
    gfx.fillRect(vx - 12*s, vy + 68*s, 10*s, 5*s);
    gfx.fillRect(vx + 2*s, vy + 68*s, 10*s, 5*s);

    // Legs
    gfx.fillStyle(app.pantsColor, 1);
    gfx.fillRect(vx - 10*s, vy + 46*s, 8*s, 24*s);
    gfx.fillRect(vx + 2*s, vy + 46*s, 8*s, 24*s);
    // Knee highlights
    gfx.fillStyle(0x34344a, 0.5);
    gfx.fillRect(vx - 9*s, vy + 54*s, 6*s, 3*s);
    gfx.fillRect(vx + 3*s, vy + 54*s, 6*s, 3*s);

    // Belt
    gfx.fillStyle(0x2a2018, 1);
    gfx.fillRect(vx - 15*s, vy + 42*s, 30*s, 5*s);
    // Belt buckle
    gfx.fillStyle(0x8a7a5a, 0.8);
    gfx.fillRect(vx - 2*s, vy + 43*s, 4*s, 3*s);

    // Body / torso
    gfx.fillStyle(bodyColor, 0.9);
    gfx.fillRect(vx - 15*s, vy, 30*s, 44*s);
    // Shirt fold shadow
    gfx.fillStyle(0x000000, 0.1);
    gfx.fillRect(vx - 1*s, vy + 6*s, 2*s, 34*s);
    // Collar
    gfx.fillStyle(app.shirtColor + 0x101010, 1);
    gfx.fillTriangle(vx - 8*s, vy, vx, vy + 8*s, vx - 14*s, vy + 2*s);
    gfx.fillTriangle(vx + 8*s, vy, vx, vy + 8*s, vx + 14*s, vy + 2*s);

    // Arms
    gfx.fillStyle(bodyColor, 0.85);
    gfx.fillRect(vx - 22*s, vy + 6*s, 8*s, 32*s);
    gfx.fillRect(vx + 14*s, vy + 6*s, 8*s, 32*s);
    // Arm shadow (inner)
    gfx.fillStyle(0x000000, 0.08);
    gfx.fillRect(vx - 16*s, vy + 8*s, 2*s, 28*s);
    gfx.fillRect(vx + 14*s, vy + 8*s, 2*s, 28*s);

    // Hands
    gfx.fillStyle(skinColor, 0.85);
    gfx.fillEllipse(vx - 18*s, vy + 40*s, 7*s, 7*s);
    gfx.fillEllipse(vx + 18*s, vy + 40*s, 7*s, 7*s);

    // Neck
    gfx.fillStyle(skinColor, 0.85);
    gfx.fillRect(vx - 4*s, vy - 5*s, 8*s, 8*s);
    // Neck shadow
    gfx.fillStyle(skinShadow, 0.5);
    gfx.fillRect(vx - 4*s, vy - 2*s, 8*s, 4*s);

    // Head
    gfx.fillStyle(skinColor, 0.9);
    gfx.fillEllipse(vx, vy - 12*s, 24*s, 28*s);

    // Ear suggestions
    gfx.fillStyle(skinShadow, 0.7);
    gfx.fillEllipse(vx - 12*s, vy - 10*s, 4*s, 6*s);
    gfx.fillEllipse(vx + 12*s, vy - 10*s, 4*s, 6*s);

    // Hair — varies by style
    gfx.fillStyle(hairColor, 1);
    switch (app.hairStyle) {
      case 'bald':
        // Just show scalp (no hair drawn)
        gfx.fillStyle(skinColor, 0.95);
        gfx.fillEllipse(vx, vy - 22*s, 24*s, 12*s);
        break;
      case 'buzzcut':
        gfx.fillEllipse(vx, vy - 22*s, 25*s, 13*s);
        break;
      case 'short':
        gfx.fillEllipse(vx, vy - 22*s, 26*s, 14*s);
        gfx.fillRect(vx - 12*s, vy - 18*s, 3*s, 10*s);
        gfx.fillRect(vx + 9*s, vy - 18*s, 3*s, 10*s);
        break;
      case 'medium':
        gfx.fillEllipse(vx, vy - 22*s, 28*s, 16*s);
        gfx.fillRect(vx - 13*s, vy - 18*s, 4*s, 16*s);
        gfx.fillRect(vx + 9*s, vy - 18*s, 4*s, 16*s);
        break;
      case 'long':
        gfx.fillEllipse(vx, vy - 22*s, 28*s, 16*s);
        gfx.fillRect(vx - 13*s, vy - 20*s, 4*s, 30*s);
        gfx.fillRect(vx + 9*s, vy - 20*s, 4*s, 30*s);
        break;
      case 'ponytail':
        gfx.fillEllipse(vx, vy - 22*s, 26*s, 14*s);
        // Ponytail behind head
        gfx.fillRect(vx + 10*s, vy - 18*s, 3*s, 20*s);
        gfx.fillEllipse(vx + 11*s, vy + 2*s, 4*s, 4*s);
        break;
    }

    // Beard
    if (app.hasBeard) {
      gfx.fillStyle(hairColor, 0.6);
      gfx.fillEllipse(vx, vy - 1*s, 10*s, 6*s);
      gfx.fillRect(vx - 6*s, vy - 6*s, 2*s, 6*s);
      gfx.fillRect(vx + 4*s, vy - 6*s, 2*s, 6*s);
    }

    // Glasses (drawn on body layer, under face layer)
    if (app.hasGlasses) {
      gfx.lineStyle(1.5*s, 0x2a2a2a, 0.8);
      gfx.strokeCircle(vx - 5*s, vy - 12*s, 3.5*s);
      gfx.strokeCircle(vx + 5*s, vy - 12*s, 3.5*s);
      gfx.lineBetween(vx - 1.5*s, vy - 12*s, vx + 1.5*s, vy - 12*s);
    }

    // Face features — drawn on separate graphics so we can animate them
    this.faceGfx = this.add.graphics();
    this.visitorSpriteContainer!.add(this.faceGfx);
    this.drawFaceExpression(-1, 'neutral'); // -1 = resting face

    // Wig guy - badly fitting wig
    if (this.currentVisitor?.isWigGuy) {
      // Draw wig sitting crooked and too high
      gfx.fillStyle(0x1a1a1a, 1); // jet black, obviously fake
      gfx.fillEllipse(vx + 4*s, vy - 24*s, 28*s, 14*s); // offset to the right
      // Visible hairline gap
      gfx.fillStyle(skinColor, 0.9);
      gfx.fillRect(vx - 10*s, vy - 18*s, 20*s, 3*s);
      // Wig edge sticking up
      gfx.fillStyle(0x1a1a1a, 1);
      gfx.fillRect(vx + 10*s, vy - 28*s, 5*s, 6*s);
    }
  }

  // ---- Face expression animation ----

  private drawFaceExpression(frame: number, expression: 'neutral' | 'angry' | 'nervous' | 'smug'): void {
    if (!this.faceGfx || !this.currentVisitor) return;
    this.faceGfx.clear();

    const vx = 400;
    const vy = 160;
    const s = 4.0;
    const app = this.currentVisitor.appearance;
    const skinShadow = app.skinShadow;
    const fg = this.faceGfx;

    // Mouth frames: -1 = resting, 0+ = talking animation
    const mouthFrame = frame < 0 ? -1 : frame % 6;

    // ---- Eyes ----
    // Expression affects eye shape/brow position
    const browOffset = expression === 'angry' ? 2*s : (expression === 'nervous' ? -1*s : 0);
    const eyeSquint = expression === 'angry' ? 0.6 : (expression === 'smug' ? 0.7 : 1.0);

    // Eyebrows
    fg.fillStyle(app.hairColor, 0.7);
    if (expression === 'angry') {
      // Angry V brows
      fg.fillTriangle(vx - 9*s, vy - 16*s + browOffset, vx - 2*s, vy - 14*s + browOffset, vx - 9*s, vy - 15*s + browOffset);
      fg.fillTriangle(vx + 9*s, vy - 16*s + browOffset, vx + 2*s, vy - 14*s + browOffset, vx + 9*s, vy - 15*s + browOffset);
    } else if (expression === 'nervous') {
      // Raised worried brows
      fg.fillRect(vx - 9*s, vy - 17*s + browOffset, 7*s, 1.5*s);
      fg.fillRect(vx + 2*s, vy - 17*s + browOffset, 7*s, 1.5*s);
    } else {
      // Neutral brows
      fg.fillRect(vx - 9*s, vy - 16*s, 7*s, 1.5*s);
      fg.fillRect(vx + 2*s, vy - 16*s, 7*s, 1.5*s);
    }

    // Eye whites
    fg.fillStyle(0xffffff, 0.9);
    fg.fillEllipse(vx - 5*s, vy - 12*s, 5*s, 3*s * eyeSquint);
    fg.fillEllipse(vx + 5*s, vy - 12*s, 5*s, 3*s * eyeSquint);

    // Pupils — shift slightly based on expression
    const pupilShiftX = expression === 'nervous' ? 0.5*s : (expression === 'smug' ? -0.3*s : 0);
    fg.fillStyle(0x1a1a1a, 1);
    fg.fillCircle(vx - 5*s + pupilShiftX, vy - 12*s, 1.5*s);
    fg.fillCircle(vx + 5*s + pupilShiftX, vy - 12*s, 1.5*s);

    // Blink on certain frames
    if (mouthFrame === 3) {
      // Blink — close eyes briefly
      fg.fillStyle(app.skinTone, 0.95);
      fg.fillEllipse(vx - 5*s, vy - 12*s, 5*s, 3*s);
      fg.fillEllipse(vx + 5*s, vy - 12*s, 5*s, 3*s);
      fg.fillStyle(app.hairColor, 0.5);
      fg.fillRect(vx - 7*s, vy - 12.5*s, 5*s, 1*s);
      fg.fillRect(vx + 2*s, vy - 12.5*s, 5*s, 1*s);
    }

    // ---- Nose ----
    fg.fillStyle(skinShadow, 0.5);
    fg.fillTriangle(vx, vy - 8*s, vx - 2*s, vy - 4*s, vx + 2*s, vy - 4*s);

    // ---- Mouth ----
    fg.fillStyle(0x8a5a4a, 0.7);

    if (mouthFrame < 0) {
      // Resting face — closed or slight smile
      if (expression === 'smug') {
        // Slight smirk
        fg.fillEllipse(vx + 1*s, vy - 2*s, 6*s, 2*s);
      } else if (expression === 'angry') {
        // Tight frown
        fg.fillRect(vx - 3*s, vy - 2*s, 6*s, 1.5*s);
      } else {
        // Neutral closed
        fg.fillEllipse(vx, vy - 2*s, 6*s, 2*s);
      }
    } else {
      // Talking frames — mouth opens/closes in a cycle
      switch (mouthFrame) {
        case 0: // slightly open
          fg.fillEllipse(vx, vy - 2*s, 5*s, 2.5*s);
          fg.fillStyle(0x3a1a1a, 0.6);
          fg.fillEllipse(vx, vy - 1.5*s, 3*s, 1.5*s);
          break;
        case 1: // wide open
          fg.fillEllipse(vx, vy - 1.5*s, 6*s, 4*s);
          fg.fillStyle(0x3a1a1a, 0.7);
          fg.fillEllipse(vx, vy - 1*s, 4*s, 3*s);
          break;
        case 2: // medium "O"
          fg.fillEllipse(vx, vy - 2*s, 4*s, 3*s);
          fg.fillStyle(0x3a1a1a, 0.6);
          fg.fillEllipse(vx, vy - 1.5*s, 2.5*s, 2*s);
          break;
        case 3: // closed (blink frame)
          fg.fillEllipse(vx, vy - 2*s, 6*s, 1.5*s);
          break;
        case 4: // wide talking
          fg.fillEllipse(vx, vy - 1*s, 7*s, 3.5*s);
          fg.fillStyle(0x3a1a1a, 0.7);
          fg.fillEllipse(vx, vy - 0.5*s, 5*s, 2.5*s);
          // Teeth hint
          fg.fillStyle(0xdddddd, 0.4);
          fg.fillRect(vx - 2*s, vy - 2*s, 4*s, 1*s);
          break;
        case 5: // back to slightly open
          fg.fillEllipse(vx, vy - 2*s, 5*s, 2*s);
          fg.fillStyle(0x3a1a1a, 0.5);
          fg.fillEllipse(vx, vy - 1.5*s, 3*s, 1*s);
          break;
      }
    }
  }

  private startTalking(personality?: string): void {
    if (!this.currentVisitor) return;

    // Pick expression based on personality
    const p = personality ?? this.currentVisitor.personality;
    if (p === 'aggressive' || p === 'angry') {
      this.talkExpression = 'angry';
    } else if (p === 'nervous' || p === 'desperate') {
      this.talkExpression = 'nervous';
    } else if (p === 'smooth' || p === 'confident') {
      this.talkExpression = 'smug';
    } else {
      this.talkExpression = 'neutral';
    }

    this.isTalking = true;
    this.talkElapsed = 0;
    this.talkFrame = 0;
    this.talkDuration = 1200 + randomInt(0, 800); // 1.2-2s of talking
  }

  // ================================================================
  // STATUS BAR (y: 862-900)
  // ================================================================

  private drawStatusBar(): void {
    this.statusBar.removeAll(true);
    const gfx = this.add.graphics();
    this.statusBar.add(gfx);

    // Dark panel background
    gfx.fillStyle(0x0d0d12, 1);
    gfx.fillRect(0, 872, 800, 28);
    // Thin gold top border
    gfx.lineStyle(1, 0x8a7a50, 1);
    gfx.lineBetween(0, 872, 800, 872);

    const state = this.gsm.getCurrentState();
    const filledCount = this.roles.filter(r => r.filledBy !== null).length;
    const totalRoles = this.roles.length;
    const timeStr = this.formatTime(state.timeOfNight);

    // Night info
    const nightLabel = this.add.text(16, 876, `NIGHT ${this.night}/7`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: '#d4c5a0',
      fontStyle: 'bold',
    });
    this.statusBar.add(nightLabel);

    // Time
    this.statusTimeText = this.add.text(140, 876, timeStr, {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: '#d4c5a0',
    });
    this.statusBar.add(this.statusTimeText);

    // Roles
    const rolesLabel = this.add.text(250, 876, `Roles: ${filledCount}/${totalRoles}`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: '#d4c5a0',
    });
    this.statusBar.add(rolesLabel);

    // Money in gold
    const moneyLabel = this.add.text(410, 876, `$${state.money}`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '20px',
      color: '#e8c36a',
      fontStyle: 'bold',
    });
    this.statusBar.add(moneyLabel);

    // Coffee cup icon + depleting level
    const coffeeX = 490;
    const coffeeY = 875;
    gfx.fillStyle(0x3a3a44, 1);
    gfx.fillRect(coffeeX, coffeeY, 10, 14);
    gfx.fillStyle(0x2a2a32, 1);
    gfx.fillRect(coffeeX - 1, coffeeY, 12, 3);
    // fill level based on coffeeLevel (0-100)
    const coffeeLevel = state.coffeeLevel ?? 100;
    const coffeeFill = Math.max(0, Math.min(1, coffeeLevel / 100));
    const coffeeFillH = Math.floor(11 * coffeeFill);
    gfx.fillStyle(0x6a4a2a, 0.8);
    gfx.fillRect(coffeeX + 1, coffeeY + 3 + (11 - coffeeFillH), 8, coffeeFillH);

    // Mistakes counter
    const mistakesColor = state.strikes >= BALANCE.strikesForWarning ? '#c4553a' : '#d4c5a0';
    const mistakesLabel = this.add.text(550, 876, `Mistakes: ${state.strikes}/${BALANCE.maxStrikes}`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: mistakesColor,
      fontStyle: state.strikes >= BALANCE.strikesForWarning ? 'bold' : 'normal',
    });
    this.statusBar.add(mistakesLabel);
  }

  // ================================================================
  // BOTTOM HALF: The Desk Workspace (y: 380-740)
  // ================================================================

  private drawBottomHalf(visitor: Visitor): void {
    this.bottomHalfContainer.removeAll(true);
    const gfx = this.add.graphics();
    this.bottomHalfContainer.add(gfx);

    // Main desk workspace background
    gfx.fillStyle(0x16140f, 1);
    gfx.fillRect(0, 380, 800, 320);

    // Warm-gold divider line separating top and bottom
    gfx.lineStyle(2, 0x8a7a50, 0.6);
    gfx.lineBetween(0, 380, 800, 380);

    // Panel dividers with subtle depth
    gfx.lineStyle(1, 0x2a261e, 1);
    gfx.lineBetween(200, 385, 200, 695);
    gfx.lineBetween(540, 385, 540, 695);

    // Panel backgrounds in slightly different shades
    // Headshot panel
    gfx.fillStyle(0x171510, 1);
    gfx.fillRect(1, 381, 199, 314);
    // Resume panel
    gfx.fillStyle(0x18160e, 1);
    gfx.fillRect(201, 381, 338, 314);
    // Book/Reel panel
    gfx.fillStyle(0x161410, 1);
    gfx.fillRect(541, 381, 259, 314);

    // Subtle inner borders for each panel
    gfx.lineStyle(1, 0x1e1c16, 0.5);
    gfx.strokeRect(4, 384, 193, 308);
    gfx.strokeRect(204, 384, 332, 308);
    gfx.strokeRect(544, 384, 252, 308);

    // Paper texture on resume panel (faint horizontal lines every 12px)
    gfx.lineStyle(1, 0x1e1c14, 0.15);
    for (let py = 396; py < 695; py += 12) {
      gfx.lineBetween(205, py, 535, py);
    }

    // LEFT: Headshot
    this.drawHeadshot(visitor, gfx);
    // CENTER: Resume
    this.drawResume(visitor);
    // RIGHT: Book + Reel
    this.drawBookAndReel(visitor);
  }

  // ---- Headshot Panel ----
  private drawHeadshot(visitor: Visitor, gfx: Phaser.GameObjects.Graphics): void {
    const hx = 16;
    const hy = 390;

    const headerText = this.add.text(hx, hy, 'HEADSHOT', {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      color: '#6a6050',
      letterSpacing: 2,
    });
    this.bottomHalfContainer.add(headerText);

    const photoY = hy + 20;
    const photoW = 110;
    const photoH = 140;
    // Use visitor appearance for headshot skin/hair if face matches, otherwise randomize
    const app = visitor.appearance;
    const skinBase = visitor.headshot.matchesFace ? app.skinTone : (visitor.gender === 'male' ? 0x8a6a4a : 0x9a7a5a);
    const hairColor = visitor.headshot.matchesFace ? app.hairColor : (visitor.gender === 'male' ? 0x3a2a1a : 0x4a3020);

    // Pose variation based on visitor ID — head tilt, eye direction, expression
    const poseHash = visitor.id.charCodeAt(visitor.id.length - 1) % 7;
    const headTiltX = [-3, 0, 3, -2, 2, 0, -4][poseHash]; // head offset left/right
    const eyeLookX = [0, -2, 2, 0, -1, 1, 0][poseHash]; // eye direction
    const mouthType = poseHash; // 0=neutral, 1=slight smile, 2=open, 3=frown, 4=smirk, 5=teeth, 6=weird

    if (visitor.headshot.type === 'color_8x10') {
      // White border (photo border)
      gfx.fillStyle(0xd8d4cc, 1);
      gfx.fillRect(hx - 2, photoY - 2, photoW + 4, photoH + 4);
      // Muted studio background — gradient
      gfx.fillStyle(0x3a5a6a, 1);
      gfx.fillRect(hx, photoY, photoW, photoH);
      gfx.fillStyle(0x2a4a5a, 0.6);
      gfx.fillRect(hx, photoY + photoH * 0.4, photoW, photoH * 0.6);
      gfx.fillStyle(0x1a3a4a, 0.3);
      gfx.fillRect(hx, photoY + photoH * 0.7, photoW, photoH * 0.3);

      const cx = hx + photoW / 2;

      // Neck
      gfx.fillStyle(skinBase, 0.9);
      gfx.fillRect(cx - 8, photoY + 70, 16, 16);
      // Neck shadow
      gfx.fillStyle(0x000000, 0.12);
      gfx.fillRect(cx - 8, photoY + 74, 16, 8);

      // Shoulders / shirt
      gfx.fillStyle(0x4a5a6a, 1);
      gfx.fillEllipse(cx, photoY + 105, 90, 70);
      // Collar V
      gfx.fillStyle(0x5a6a7a, 1);
      gfx.fillTriangle(cx - 10, photoY + 80, cx, photoY + 95, cx + 10, photoY + 80);
      // Shirt shadow
      gfx.fillStyle(0x000000, 0.08);
      gfx.fillRect(cx - 1, photoY + 88, 2, 30);

      // Face — oval with jawline, offset by pose
      const fcx = cx + headTiltX;
      gfx.fillStyle(skinBase, 1);
      gfx.fillEllipse(fcx, photoY + 48, 48, 56);
      gfx.fillStyle(0x000000, 0.08);
      gfx.fillEllipse(fcx, photoY + 58, 44, 36);

      // Ears
      gfx.fillStyle(skinBase, 0.8);
      gfx.fillEllipse(fcx - 24, photoY + 46, 6, 10);
      gfx.fillEllipse(fcx + 24, photoY + 46, 6, 10);

      // Hair
      gfx.fillStyle(hairColor, 1);
      gfx.fillEllipse(fcx, photoY + 28, 52, 30);
      if (visitor.gender !== 'male') {
        gfx.fillRect(fcx - 26, photoY + 26, 6, 40);
        gfx.fillRect(fcx + 20, photoY + 26, 6, 40);
      }

      // Eyes — whites + iris + pupil, with gaze direction
      gfx.fillStyle(0xffffff, 0.85);
      gfx.fillEllipse(fcx - 9, photoY + 44, 10, 6);
      gfx.fillEllipse(fcx + 9, photoY + 44, 10, 6);
      gfx.fillStyle(0x4a6a5a, 1);
      gfx.fillCircle(fcx - 9 + eyeLookX, photoY + 44, 2.5);
      gfx.fillCircle(fcx + 9 + eyeLookX, photoY + 44, 2.5);
      gfx.fillStyle(0x1a1a1a, 1);
      gfx.fillCircle(fcx - 9 + eyeLookX, photoY + 44, 1.2);
      gfx.fillCircle(fcx + 9 + eyeLookX, photoY + 44, 1.2);

      // Eyebrows — raised/lowered based on expression
      gfx.fillStyle(hairColor, 0.7);
      const browOffset = mouthType === 2 ? -2 : mouthType === 3 ? 1 : 0;
      gfx.fillRect(fcx - 14, photoY + 38 + browOffset, 10, 2);
      gfx.fillRect(fcx + 4, photoY + 38 + browOffset, 10, 2);

      // Nose
      gfx.fillStyle(0x000000, 0.1);
      gfx.fillTriangle(fcx, photoY + 48, fcx - 4, photoY + 57, fcx + 4, photoY + 57);
      gfx.fillStyle(skinBase, 0.8);
      gfx.fillCircle(fcx - 3, photoY + 56, 2);
      gfx.fillCircle(fcx + 3, photoY + 56, 2);

      // Mouth — varies by pose
      gfx.fillStyle(0x8a4a3a, 0.6);
      if (mouthType === 0) {
        gfx.fillEllipse(fcx, photoY + 63, 12, 4); // neutral
      } else if (mouthType === 1) {
        gfx.fillEllipse(fcx, photoY + 63, 14, 3); // slight smile
        gfx.fillStyle(skinBase, 0.5);
        gfx.fillEllipse(fcx, photoY + 61, 10, 2);
      } else if (mouthType === 2) {
        gfx.fillEllipse(fcx, photoY + 63, 10, 6); // surprised/open
      } else if (mouthType === 3) {
        gfx.fillRect(fcx - 5, photoY + 63, 10, 2); // flat/frown
      } else if (mouthType === 4) {
        gfx.fillEllipse(fcx + 2, photoY + 63, 10, 3); // smirk (offset)
      } else if (mouthType === 5) {
        gfx.fillEllipse(fcx, photoY + 63, 12, 5); // showing teeth
        gfx.fillStyle(0xd8d0c0, 0.5);
        gfx.fillRect(fcx - 4, photoY + 62, 8, 2);
      } else {
        // Weird expression — one eye squinting, crooked smile
        gfx.fillEllipse(fcx + 3, photoY + 64, 8, 4);
      }

      // Studio light catch
      gfx.fillStyle(0xffffff, 0.06);
      gfx.fillEllipse(fcx - 12, photoY + 42, 12, 20);

      const nameText = this.add.text(hx + 4, photoY + photoH + 6, visitor.name, {
        fontFamily: 'Courier New, monospace',
        fontSize: '14px',
        color: '#d4c5a0',
      });
      this.bottomHalfContainer.add(nameText);

    } else if (visitor.headshot.type === 'atlanta_comp') {
      // Comp card border
      gfx.fillStyle(0xc8c0b0, 1);
      gfx.fillRect(hx - 2, photoY - 2, photoW + 4, photoH + 4);
      gfx.fillStyle(0x1a1816, 1);
      gfx.fillRect(hx, photoY, photoW, photoH);

      // 2x2 grid of small photos
      const compW = 58;
      const compH = 74;
      const gap = 4;
      const headAngles = [0, -3, 2, -1];
      const bgColors = [0x3a5a5a, 0x5a4a3a, 0x3a4a5a, 0x4a4a3a];
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 2; col++) {
          const idx = row * 2 + col;
          const px = hx + 4 + col * (compW + gap);
          const py = photoY + 4 + row * (compH + gap);

          // Photo background
          gfx.fillStyle(bgColors[idx], 1);
          gfx.fillRect(px, py, compW, compH);
          gfx.lineStyle(1, 0x5a6a7a, 0.4);
          gfx.strokeRect(px, py, compW, compH);

          const fcx = px + compW / 2 + headAngles[idx];

          // Neck
          gfx.fillStyle(skinBase, 0.85);
          gfx.fillRect(fcx - 4, py + 32, 8, 8);

          // Shoulders
          gfx.fillStyle(0x4a5a6a, 1);
          gfx.fillEllipse(fcx, py + 52, 44, 34);

          // Face
          gfx.fillStyle(skinBase, 1);
          gfx.fillEllipse(fcx, py + 22, 22, 26);
          // Hair
          gfx.fillStyle(hairColor, 1);
          gfx.fillEllipse(fcx, py + 13, 24, 14);
          // Eyes
          gfx.fillStyle(0x1a1a1a, 1);
          gfx.fillCircle(fcx - 4, py + 21, 1.2);
          gfx.fillCircle(fcx + 4, py + 21, 1.2);
          // Nose hint
          gfx.fillStyle(0x000000, 0.08);
          gfx.fillCircle(fcx, py + 26, 1.5);
          // Mouth
          gfx.fillStyle(0x8a4a3a, 0.4);
          gfx.fillRect(fcx - 3, py + 29, 6, 1.5);
        }
      }

      const nameText = this.add.text(hx + 4, photoY + photoH + 6, visitor.name, {
        fontFamily: 'Courier New, monospace',
        fontSize: '14px',
        color: '#d4c5a0',
      });
      this.bottomHalfContainer.add(nameText);

    } else {
      // bw_8x10 — grayscale with dramatic lighting
      gfx.fillStyle(0xc8c8c8, 1);
      gfx.fillRect(hx - 2, photoY - 2, photoW + 4, photoH + 4);
      gfx.fillStyle(0x4a4a4a, 1);
      gfx.fillRect(hx, photoY, photoW, photoH);
      gfx.fillStyle(0x3a3a3a, 0.5);
      gfx.fillRect(hx, photoY + photoH * 0.4, photoW, photoH * 0.6);

      const cx = hx + photoW / 2;
      const skinGray = 0x8a8a8a;
      const hairGray = 0x4a4a4a;

      // Neck
      gfx.fillStyle(skinGray, 0.85);
      gfx.fillRect(cx - 8, photoY + 70, 16, 16);

      // Shoulders
      gfx.fillStyle(0x5a5a5a, 1);
      gfx.fillEllipse(cx, photoY + 105, 90, 70);
      // Collar
      gfx.fillStyle(0x6a6a6a, 1);
      gfx.fillTriangle(cx - 10, photoY + 80, cx, photoY + 95, cx + 10, photoY + 80);

      // Face
      gfx.fillStyle(skinGray, 1);
      gfx.fillEllipse(cx, photoY + 48, 48, 56);
      // Jaw shadow
      gfx.fillStyle(0x000000, 0.1);
      gfx.fillEllipse(cx, photoY + 58, 44, 36);

      // Ears
      gfx.fillStyle(skinGray, 0.7);
      gfx.fillEllipse(cx - 24, photoY + 46, 6, 10);
      gfx.fillEllipse(cx + 24, photoY + 46, 6, 10);

      // Hair
      gfx.fillStyle(hairGray, 1);
      gfx.fillEllipse(cx, photoY + 28, 52, 30);

      // Eyes
      gfx.fillStyle(0xc0c0c0, 0.8);
      gfx.fillEllipse(cx - 9, photoY + 44, 10, 6);
      gfx.fillEllipse(cx + 9, photoY + 44, 10, 6);
      gfx.fillStyle(0x2a2a2a, 1);
      gfx.fillCircle(cx - 9, photoY + 44, 2.5);
      gfx.fillCircle(cx + 9, photoY + 44, 2.5);

      // Eyebrows
      gfx.fillStyle(hairGray, 0.7);
      gfx.fillRect(cx - 14, photoY + 38, 10, 2);
      gfx.fillRect(cx + 4, photoY + 38, 10, 2);

      // Nose
      gfx.fillStyle(0x000000, 0.1);
      gfx.fillTriangle(cx, photoY + 48, cx - 4, photoY + 57, cx + 4, photoY + 57);

      // Mouth
      gfx.fillStyle(0x5a5a5a, 0.6);
      gfx.fillEllipse(cx, photoY + 63, 12, 4);

      // Dramatic side lighting — bright on left, dark on right
      gfx.fillStyle(0xffffff, 0.08);
      gfx.fillRect(hx, photoY, photoW / 3, photoH);
      gfx.fillStyle(0x000000, 0.1);
      gfx.fillRect(hx + photoW * 0.7, photoY, photoW * 0.3, photoH);

      // Film grain
      for (let g = 0; g < 60; g++) {
        const gx = hx + randomInt(0, photoW);
        const gy = photoY + randomInt(0, photoH);
        gfx.fillStyle(0x000000, 0.08 + Math.random() * 0.12);
        gfx.fillRect(gx, gy, 1, 1);
      }

      const nameText = this.add.text(hx + 4, photoY + photoH + 6, visitor.name, {
        fontFamily: 'Courier New, monospace',
        fontSize: '14px',
        color: '#aaaaaa',
      });
      this.bottomHalfContainer.add(nameText);
    }

    // Make headshot clickable
    const headshotZone = this.add.zone(hx + photoW / 2, photoY + photoH / 2, photoW, photoH)
      .setInteractive({ useHandCursor: true });
    this.bottomHalfContainer.add(headshotZone);
    headshotZone.on('pointerdown', () => {
      this.idleTimer = 0;
      if (!visitor.headshot.matchesFace) {
        // Headshot doesn't match — trigger mismatch dialogue
        const response = visitor.dialogueResponses['headshot_mismatch'] ?? 'Uh... that\'s me. Definitely me.';
        this.conversationHistory.push({ question: 'This headshot doesn\'t look like you...', answer: response });
        this.startTalking('nervous');
        this.drawDialogue(visitor);
      } else {
        this.conversationHistory.push({ question: '', answer: '[Headshot matches. Looks legit.]' });
        this.drawDialogue(visitor);
      }
    });

    // Bribe is now handled in dialogue area, not here
  }

  // ---- Resume Panel ----
  private drawResume(visitor: Visitor): void {
    const rx = 214;
    let ry = 390;

    // Paper background — each visitor has slightly different paper color/texture
    const paperHash = visitor.id.charCodeAt(0) % 4;
    const paperColors = [0xd8d0c0, 0xc8c0b0, 0xd0c8b8, 0xe0d8c8];
    const paperColor = paperColors[paperHash];
    const resumeGfx = this.add.graphics();
    this.bottomHalfContainer.add(resumeGfx);
    // Paper rectangle with slight rotation feel
    resumeGfx.fillStyle(paperColor, 0.12);
    resumeGfx.fillRect(203, 384, 334, 308);
    // Subtle fold line / crease
    resumeGfx.lineStyle(1, paperColor, 0.06);
    resumeGfx.lineBetween(210, 440 + paperHash * 30, 530, 440 + paperHash * 30);
    // Coffee ring stain (some resumes)
    if (paperHash === 2) {
      resumeGfx.lineStyle(2, 0x6a4a2a, 0.04);
      resumeGfx.strokeCircle(500, 650, 14);
    }
    // Corner dog-ear (some resumes)
    if (paperHash === 1 || paperHash === 3) {
      resumeGfx.fillStyle(paperColor, 0.15);
      resumeGfx.fillTriangle(530, 384, 537, 384, 537, 398);
    }

    const headerText = this.add.text(rx, ry, 'RESUME', {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      color: '#6a6050',
      letterSpacing: 2,
    });
    this.bottomHalfContainer.add(headerText);
    ry += 18;

    const nameText = this.add.text(rx, ry, visitor.name, {
      fontFamily: 'Courier New, monospace',
      fontSize: '22px',
      color: '#d4c5a0',
      fontStyle: 'bold',
    });
    this.bottomHalfContainer.add(nameText);
    ry += 28;

    // Height / Weight
    const hwText = this.add.text(rx, ry, `${visitor.resume.listedHeight}  ${visitor.resume.listedWeight}`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: '#d4c5a0',
    });
    this.bottomHalfContainer.add(hwText);
    ry += 24;

    // Skills
    const skillsHeader = this.add.text(rx, ry, 'Skills:', {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      color: '#6a6050',
    });
    this.bottomHalfContainer.add(skillsHeader);
    ry += 18;

    const skillStr = visitor.resume.skills.length > 0
      ? visitor.resume.skills.map(s => s.replace(/_/g, ' ')).join(', ')
      : '(none listed)';
    const skillText = this.add.text(rx, ry, skillStr, {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      color: '#d4c5a0',
      wordWrap: { width: 250 },
    });
    this.bottomHalfContainer.add(skillText);
    ry += Math.ceil(skillStr.length / 24) * 18 + 8;

    // Credits (limited to 3, with word wrap)
    const creditsHeader = this.add.text(rx, ry, 'Credits:', {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      color: '#6a6050',
    });
    this.bottomHalfContainer.add(creditsHeader);
    ry += 16;

    if (visitor.resume.credits.length > 0) {
      visitor.resume.credits.slice(0, 3).forEach(credit => {
        const creditLine = `- ${credit}`;
        const creditText = this.add.text(rx + 8, ry, creditLine, {
          fontFamily: 'Courier New, monospace',
          fontSize: '13px',
          color: '#d4c5a0',
          wordWrap: { width: 290 },
        });
        this.bottomHalfContainer.add(creditText);
        // Account for word-wrapped lines (~30 chars per line at 13px)
        const estimatedLines = Math.ceil(creditLine.length / 30);
        ry += estimatedLines * 15 + 2;
      });
    } else {
      const noneText = this.add.text(rx + 8, ry, '(none)', {
        fontFamily: 'Courier New, monospace',
        fontSize: '14px',
        color: '#6a6050',
      });
      this.bottomHalfContainer.add(noneText);
      ry += 15;
    }
    ry += 6;

    // Coordinator refs
    const refsHeader = this.add.text(rx, ry, 'Coord Refs:', {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      color: '#6a6050',
    });
    this.bottomHalfContainer.add(refsHeader);
    ry += 16;

    if (visitor.resume.coordinatorRefs.length > 0) {
      visitor.resume.coordinatorRefs.slice(0, 3).forEach(ref => {
        const refColor = ref.realCoordinator ? '#d4c5a0' : '#6a6050';
        const refText = this.add.text(rx + 8, ry, `- ${ref.name} (${ref.city})`, {
          fontFamily: 'Courier New, monospace',
          fontSize: '14px',
          color: refColor,
          wordWrap: { width: 300 },
        });
        this.bottomHalfContainer.add(refText);
        ry += 15;
      });
    } else {
      const noneText = this.add.text(rx + 8, ry, '(none)', {
        fontFamily: 'Courier New, monospace',
        fontSize: '14px',
        color: '#6a6050',
      });
      this.bottomHalfContainer.add(noneText);
    }
  }

  // ---- Book + Reel Panel ----
  private drawBookAndReel(visitor: Visitor): void {
    const px = 544;
    let py = 386;

    // Book — compact leather-bound look
    const bookGfx = this.add.graphics();
    this.bottomHalfContainer.add(bookGfx);

    const bookH = 180;
    // Leather cover
    bookGfx.fillStyle(0x2a1a0e, 1);
    bookGfx.fillRoundedRect(px - 4, py, 248, bookH, 3);
    // Spine with stitching
    bookGfx.fillStyle(0x1a0e06, 1);
    bookGfx.fillRect(px - 4, py, 6, bookH);
    bookGfx.lineStyle(1, 0x3a2a1a, 0.4);
    for (let sy = py + 8; sy < py + bookH - 4; sy += 8) {
      bookGfx.fillStyle(0x4a3a2a, 0.3);
      bookGfx.fillRect(px - 3, sy, 4, 2);
    }
    // Page edges (right)
    bookGfx.fillStyle(0xd8d0c0, 0.25);
    bookGfx.fillRect(px + 240, py + 4, 3, bookH - 8);
    // Bottom page edge
    bookGfx.fillStyle(0xd8d0c0, 0.15);
    bookGfx.fillRect(px + 6, py + bookH - 3, 234, 3);
    // Gold emboss title
    bookGfx.fillStyle(0x8a6a3a, 0.15);
    bookGfx.fillRect(px + 30, py + 4, 180, 18);

    const headerText = this.add.text(px + 120, py + 6, 'STUNTLISTING', {
      fontFamily: 'Courier New, monospace',
      fontSize: '13px',
      color: '#8a6a3a',
      fontStyle: 'bold',
      letterSpacing: 1,
    }).setOrigin(0.5, 0);
    this.bottomHalfContainer.add(headerText);
    py += 24;

    // Look Up button
    const lastName = visitor.name.split(' ').slice(-1)[0] || visitor.name;

    const lookupBg = this.add.graphics();
    this.bottomHalfContainer.add(lookupBg);
    lookupBg.fillStyle(0x2a2618, 1);
    lookupBg.fillRoundedRect(px + 6, py, 226, 30, 3);
    lookupBg.lineStyle(1, 0x5a4a2a, 1);
    lookupBg.strokeRoundedRect(px + 6, py, 226, 30, 3);

    const lookupBtn = this.add.text(px + 14, py + 6, `LOOK UP: ${lastName}`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '15px',
      color: '#e8c36a',
      fontStyle: 'bold',
    }).setInteractive({ useHandCursor: true });
    this.bottomHalfContainer.add(lookupBtn);
    py += 34;

    // Book result area
    this.bookResultText = this.add.text(px + 6, py, '', {
      fontFamily: 'Courier New, monospace',
      fontSize: '11px',
      color: '#d4c5a0',
      wordWrap: { width: 220 },
      lineSpacing: 2,
    });
    this.bottomHalfContainer.add(this.bookResultText);

    lookupBtn.on('pointerdown', () => {
      this.idleTimer = 0;
      this.lookUpBook(visitor);
    });

    // Reel section — compact to fit above dialogue buttons (y=706)
    const reelY = 580;
    const reelGfx = this.add.graphics();
    this.bottomHalfContainer.add(reelGfx);

    const reelHeader = this.add.text(px, reelY, 'STUNT REEL', {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      color: '#6a6050',
      letterSpacing: 2,
    });
    this.bottomHalfContainer.add(reelHeader);

    // TV / monitor rectangle - with bezel
    reelGfx.fillStyle(0x1a1a22, 1);
    reelGfx.fillRect(px - 2, reelY + 16, 234, 70);
    reelGfx.fillStyle(0x0a0a12, 1);
    reelGfx.fillRect(px + 4, reelY + 22, 222, 58);
    reelGfx.lineStyle(1, 0x2a2a36, 1);
    reelGfx.strokeRect(px - 2, reelY + 16, 234, 70);
    // tiny power LED
    reelGfx.fillStyle(visitor.skillReel ? 0x4a7a4f : 0x3a3a44, 1);
    reelGfx.fillCircle(px + 225, reelY + 26, 2);

    // Scanlines on TV
    reelGfx.lineStyle(1, 0x000000, 0.06);
    for (let sy = reelY + 24; sy < reelY + 78; sy += 3) {
      reelGfx.lineBetween(px + 5, sy, px + 225, sy);
    }

    this.reelDisplayText = this.add.text(px + 14, reelY + 30, visitor.skillReel ? 'TAPE READY' : 'NO TAPE', {
      fontFamily: 'Courier New, monospace',
      fontSize: '12px',
      color: visitor.skillReel ? '#4a7a4f' : '#6a6050',
      wordWrap: { width: 200 },
    });
    this.bottomHalfContainer.add(this.reelDisplayText);

    if (visitor.skillReel) {
      const playBg = this.add.graphics();
      this.bottomHalfContainer.add(playBg);
      playBg.fillStyle(0x2a2618, 1);
      playBg.fillRoundedRect(px, reelY + 90, 140, 30, 3);
      playBg.lineStyle(1, 0x5a4a2a, 1);
      playBg.strokeRoundedRect(px, reelY + 90, 140, 30, 3);

      const playBtn = this.add.text(px + 8, reelY + 96, 'PLAY REEL', {
        fontFamily: 'Courier New, monospace',
        fontSize: '16px',
        color: '#e8c36a',
        fontStyle: 'bold',
      }).setInteractive({ useHandCursor: true });
      this.bottomHalfContainer.add(playBtn);

      playBtn.on('pointerdown', () => {
        this.idleTimer = 0;
        this.playReel(visitor);
      });
    }
  }

  // ---- Dialogue Area ----
  private drawDialogue(visitor: Visitor): void {
    this.dialogueContainer.removeAll(true);

    const gfx = this.add.graphics();
    this.dialogueContainer.add(gfx);

    // Question buttons row
    const btnY = 706;
    const btnH = 34;
    const options = [
      { key: 'tell_me_about_experience', label: 'Experience?' },
      { key: 'about_your_reel', label: 'Skills?' },
      { key: 'where_are_you_from', label: 'From where?' },
      { key: 'are_you_sag', label: 'Show SAG Card' },
    ];

    const totalW = 780;
    const btnGap = 8;
    const btnW = (totalW - btnGap * 3) / 4;
    const startX = 10;

    options.forEach((opt, i) => {
      const bx = startX + i * (btnW + btnGap);
      const btnBg = this.add.graphics();
      this.dialogueContainer.add(btnBg);
      btnBg.fillStyle(0x1a1816, 0.9);
      btnBg.fillRoundedRect(bx, btnY, btnW, btnH, 4);
      btnBg.lineStyle(1, 0x3a352e, 0.8);
      btnBg.strokeRoundedRect(bx, btnY, btnW, btnH, 4);

      const btn = this.add.text(bx + btnW / 2, btnY + btnH / 2, opt.label, {
        fontFamily: 'Courier New, monospace',
        fontSize: '16px',
        color: '#e8c36a',
        fontStyle: 'bold',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      btn.on('pointerdown', () => {
        this.idleTimer = 0;
        const count = (this.dialogueClickCounts[opt.key] || 0) + 1;
        this.dialogueClickCounts[opt.key] = count;

        // Special SAG card handling
        if (opt.key === 'are_you_sag') {
          this.handleSagCardRequest(visitor, count);
          return;
        }

        // For other questions, check if this question touches a lie
        const responseKey = count <= 1 ? opt.key : `${opt.key}_${count}`;
        let response = visitor.dialogueResponses[responseKey] ?? visitor.dialogueResponses[opt.key] ?? '...';

        // Lie detection hints: if this visitor has a tell related to this question
        if (this.checkForLieHint(visitor, opt.key, count)) {
          // The response already includes the hint from dialogueResponses
          // But the visitor gets nervous if we've caught them before
          if (this.playerKnowsLie && count >= 2) {
            response += ' *shifts uncomfortably*';
          }
        }

        this.conversationHistory.push({ question: opt.label, answer: response });
        this.startTalking();
        this.drawDialogue(visitor);
      });

      this.dialogueContainer.add(btn);
    });

    // Conversation box
    const convoY = 744;
    const convoH = 72;
    gfx.fillStyle(0x0e0e14, 0.92);
    gfx.fillRoundedRect(10, convoY, 780, convoH, 4);
    gfx.lineStyle(1, 0x2a2a36, 0.8);
    gfx.strokeRoundedRect(10, convoY, 780, convoH, 4);

    this.renderConversationHistory(10, convoY, convoH);

    // Action buttons
    const actionY = 820;
    const actionBtnH = 36;

    const hasBribe = visitor.bribeOffer && !this.bribeAccepted && !this.bribeRefused;

    // HIRE button — shows bribe if present
    const hireLabelText = hasBribe
      ? `HIRE (w/ $${visitor.bribeOffer!.amount})`
      : 'HIRE';
    const hireBtnW = 380;

    const hireBg = this.add.graphics();
    this.dialogueContainer.add(hireBg);
    hireBg.fillStyle(0x1a3a1e, 1);
    hireBg.fillRoundedRect(10, actionY, hireBtnW, actionBtnH, 6);
    hireBg.lineStyle(2, 0x4a7a4f, 1);
    hireBg.strokeRoundedRect(10, actionY, hireBtnW, actionBtnH, 6);

    const hireBtn = this.add.text(10 + hireBtnW / 2, actionY + actionBtnH / 2, hireLabelText, {
      fontFamily: 'Courier New, monospace',
      fontSize: '20px',
      color: '#6aba6f',
      fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    hireBtn.on('pointerdown', () => {
      this.idleTimer = 0;
      // Bribe is accepted only after actually assigning to a role (in hireVisitor)
      this.showRolePicker(visitor);
    });
    this.dialogueContainer.add(hireBtn);

    // GET LOST button — if bribe is active, say "keep your money"
    const getLostX = 398;
    const getLostW = 392;
    const getLostLabel = hasBribe
      ? `GET LOST (keep your $${visitor.bribeOffer!.amount})`
      : 'GET LOST';

    const rejectBg = this.add.graphics();
    this.dialogueContainer.add(rejectBg);
    rejectBg.fillStyle(0x3a1a1a, 1);
    rejectBg.fillRoundedRect(getLostX, actionY, getLostW, actionBtnH, 6);
    rejectBg.lineStyle(2, 0xc4553a, 1);
    rejectBg.strokeRoundedRect(getLostX, actionY, getLostW, actionBtnH, 6);

    const rejectBtn = this.add.text(getLostX + getLostW / 2, actionY + actionBtnH / 2, getLostLabel, {
      fontFamily: 'Courier New, monospace',
      fontSize: hasBribe ? '14px' : '20px',
      color: '#e06050',
      fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    rejectBtn.on('pointerdown', () => {
      this.idleTimer = 0;
      this.rejectVisitor(visitor);
    });
    this.dialogueContainer.add(rejectBtn);
  }

  private renderConversationHistory(panelX: number, convoY: number, convoH: number): void {
    // Always show the MOST RECENT entry only (so user sees latest Q&A)
    let ty = convoY + 4;

    if (this.conversationHistory.length === 0) {
      // Show the greeting as a single response
      this.currentDialogueText = this.add.text(panelX + 8, ty, '', {
        fontFamily: 'Courier New, monospace',
        fontSize: '16px',
        color: '#d4c5a0',
        wordWrap: { width: 760 },
        lineSpacing: 2,
      });
      this.dialogueContainer.add(this.currentDialogueText);
      return;
    }

    this.currentDialogueText = null;

    // Show only the last entry — always visible, never cut off
    const entry = this.conversationHistory[this.conversationHistory.length - 1];

    // Question (dim) — skip if it's a system message (empty question)
    if (entry.question) {
      const qText = this.add.text(panelX + 8, ty, `> ${entry.question}`, {
        fontFamily: 'Courier New, monospace',
        fontSize: '14px',
        color: '#6a6050',
        wordWrap: { width: 760 },
      });
      this.dialogueContainer.add(qText);
      ty += 18;
    }

    // Answer (bright)
    const aText = this.add.text(panelX + 8, ty, entry.answer, {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      color: '#d4c5a0',
      wordWrap: { width: 760 },
      lineSpacing: 1,
    });
    this.dialogueContainer.add(aText);
  }

  // ================================================================
  // VHS / ATMOSPHERE EFFECTS
  // ================================================================

  private drawVHSOverlay(): void {
    // Scanlines across the entire screen
    const scanGfx = this.add.graphics();
    this.vhsOverlayContainer.add(scanGfx);
    scanGfx.lineStyle(1, 0x000000, 0.04);
    for (let sy = 0; sy < 900; sy += 3) {
      scanGfx.lineBetween(0, sy, 800, sy);
    }

    // Vignette - darken corners and edges
    const vigGfx = this.add.graphics();
    this.vhsOverlayContainer.add(vigGfx);
    // Top edge
    vigGfx.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.3, 0.3, 0, 0);
    vigGfx.fillRect(0, 0, 800, 60);
    // Bottom edge
    vigGfx.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.3, 0.3);
    vigGfx.fillRect(0, 840, 800, 60);
    // Left edge
    vigGfx.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.25, 0, 0.25, 0);
    vigGfx.fillRect(0, 0, 50, 900);
    // Right edge
    vigGfx.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0.25, 0, 0.25);
    vigGfx.fillRect(750, 0, 50, 900);

    // Film grain graphics (will be redrawn in update loop)
    this.grainGraphics = this.add.graphics();
    this.vhsOverlayContainer.add(this.grainGraphics);
  }

  private drawFilmGrain(): void {
    if (!this.grainGraphics) return;
    this.grainGraphics.clear();
    for (let i = 0; i < 25; i++) {
      const gx = randomInt(0, 800);
      const gy = randomInt(0, 900);
      this.grainGraphics.fillStyle(0x000000, 0.02 + Math.random() * 0.02);
      this.grainGraphics.fillRect(gx, gy, 1, 1);
    }
    // A few lighter grain dots too
    for (let i = 0; i < 10; i++) {
      const gx = randomInt(0, 800);
      const gy = randomInt(0, 900);
      this.grainGraphics.fillStyle(0xffffff, 0.01 + Math.random() * 0.015);
      this.grainGraphics.fillRect(gx, gy, 1, 1);
    }
  }

  private doLightFlicker(): void {
    if (!this.workLightGfx) return;
    // Briefly reduce the work light glow
    this.drawWorkLightGlow(0.7);
    this.time.delayedCall(100, () => {
      if (this.workLightGfx) {
        this.drawWorkLightGlow(1.0);
      }
    });
  }

  // ================================================================
  // PRESENT VISITOR (game logic - preserved)
  // ================================================================

  private presentVisitor(visitor: Visitor): void {
    // SAG rep gets their own special screen — not a normal visitor
    if (visitor.isSagRep) {
      this.showSagRepEncounter(visitor);
      return;
    }

    this.currentVisitor = visitor;
    this.idleTimer = 0;
    this.bribeAccepted = false;
    this.bribeRefused = false;
    this.sagCardShown = false;
    this.visitorTells = [];
    this.playerKnowsLie = false;
    this.conversationHistory = [];
    this.dialogueClickCounts = {};
    if (this.thoughtBubble) {
      this.thoughtBubble.destroy();
      this.thoughtBubble = null;
    }

    // No time jump — clock ticks continuously in update loop

    // Drain coffee
    const state = this.gsm.getCurrentState();
    this.gsm.updateState({
      coffeeLevel: Math.max(0, state.coffeeLevel - BALANCE.coffeeDrainPerVisitor),
      currentVisitorIndex: this.currentVisitorIndex,
      currentVisitor: visitor,
    });

    // Redraw top half
    this.topHalfContainer.removeAll(true);
    this.drawTopHalf();
    this.drawCurrentVisitorSprite();

    // Draw bottom half
    this.drawBottomHalf(visitor);

    // Draw dialogue
    this.drawDialogue(visitor);

    // Update status
    this.drawStatusBar();

    // Show greeting
    this.showVisitorResponse(visitor.dialogueResponses['greeting'] ?? `Hey. I'm ${visitor.name}.`);
    this.startTalking();

    // Bribe is now shown on the HIRE button — no separate conversation event needed
  }

  // ================================================================
  // ACTIONS (game logic - preserved)
  // ================================================================

  private showVisitorResponse(text: string): void {
    if (this.currentDialogueText) {
      this.currentDialogueText.setText(text);
    } else if (this.currentVisitor) {
      // If no standalone dialogue text (conversation mode), add as a system entry
      this.conversationHistory.push({ question: '', answer: text });
      this.drawDialogue(this.currentVisitor);
    }
  }

  private showSagCardVisual(visitor: Visitor): void {
    const cardGfx = this.add.graphics();
    this.bottomHalfContainer.add(cardGfx);

    const cx = 16;
    const cy = 580;
    const cw = 170;
    const ch = 100;

    if (visitor.sagCard && visitor.sagCard.present) {
      this.sagCardShown = true;

      // Determine if this is a fake "SAD" card (fakers with expired/none SAG, 20% chance)
      const isFakeCard = !visitor.canDoTheJob && !visitor.sagCard.valid;
      const isSadCard = isFakeCard && (visitor.id.charCodeAt(visitor.id.length - 1) % 5 === 0);

      // Card background
      cardGfx.fillStyle(isSadCard ? 0xd0c8a0 : (visitor.sagCard.valid ? 0xd8d0b8 : 0xc8b898), 1);
      cardGfx.fillRoundedRect(cx, cy, cw, ch, 4);
      cardGfx.lineStyle(1, 0x8a7a5a, 1);
      cardGfx.strokeRoundedRect(cx, cy, cw, ch, 4);

      // SAG/SAD logo area
      cardGfx.fillStyle(isSadCard ? 0x4a2a2a : 0x2a4a8a, 1);
      cardGfx.fillRect(cx + 8, cy + 6, 50, 14);

      const logoText = isSadCard ? 'SAD' : 'SAG';
      const sagLabel = this.add.text(cx + 12, cy + 8, logoText, {
        fontFamily: 'Courier New, monospace',
        fontSize: '10px',
        color: '#ffffff',
        fontStyle: 'bold',
      });
      this.bottomHalfContainer.add(sagLabel);

      if (isSadCard) {
        this.visitorTells.push('fake_sag_card');
      }

      // Member name
      const cardNameText = this.add.text(cx + 8, cy + 26, visitor.sagCard.name, {
        fontFamily: 'Courier New, monospace',
        fontSize: '11px',
        color: '#1a1a1a',
        fontStyle: 'bold',
        wordWrap: { width: cw - 16 },
      });
      this.bottomHalfContainer.add(cardNameText);

      // Status
      const statusColor = visitor.sagCard.valid ? '#2a6a2a' : '#8a2a2a';
      const statusLabel = visitor.sagCard.valid ? 'CURRENT' : 'EXPIRED';
      const cardStatusText = this.add.text(cx + 8, cy + 50, statusLabel, {
        fontFamily: 'Courier New, monospace',
        fontSize: '12px',
        color: statusColor,
        fontStyle: 'bold',
      });
      this.bottomHalfContainer.add(cardStatusText);

      // Location on card — key tell!
      const locMismatch = visitor.sagCard.location !== 'Localville';
      const locColor = locMismatch ? '#8a2a2a' : '#4a4a4a';
      const cardLocText = this.add.text(cx + 8, cy + 66, visitor.sagCard.location, {
        fontFamily: 'Courier New, monospace',
        fontSize: '11px',
        color: locColor,
        fontStyle: 'bold',
      });
      this.bottomHalfContainer.add(cardLocText);

      if (locMismatch) {
        this.visitorTells.push('sag_wrong_location');
      }

      // Membership number
      const memNumText = this.add.text(cx + 8, cy + 82, `#${Math.floor(Math.random() * 900000 + 100000)}`, {
        fontFamily: 'Courier New, monospace',
        fontSize: '9px',
        color: '#4a4a4a',
      });
      this.bottomHalfContainer.add(memNumText);

      // Expired stamp
      if (!visitor.sagCard.valid) {
        cardGfx.lineStyle(3, 0xc44020, 0.6);
        cardGfx.strokeRect(cx + 60, cy + 40, 90, 30);
        const expStamp = this.add.text(cx + 105, cy + 48, 'EXPIRED', {
          fontFamily: 'Courier New, monospace',
          fontSize: '12px',
          color: '#c44020',
          fontStyle: 'bold',
        }).setOrigin(0.5).setAngle(-8);
        this.bottomHalfContainer.add(expStamp);
        this.visitorTells.push('expired_sag');
      }
    } else {
      // No card shown
      cardGfx.fillStyle(0x1a1a22, 0.8);
      cardGfx.fillRoundedRect(cx, cy, cw, ch, 4);
      cardGfx.lineStyle(1, 0x3a3a44, 0.6);
      cardGfx.strokeRoundedRect(cx, cy, cw, ch, 4);

      const noCardText = this.add.text(cx + cw / 2, cy + ch / 2, 'NO CARD\nSHOWN', {
        fontFamily: 'Courier New, monospace',
        fontSize: '14px',
        color: '#c4553a',
        fontStyle: 'bold',
        align: 'center',
      }).setOrigin(0.5);
      this.bottomHalfContainer.add(noCardText);
      this.visitorTells.push('no_sag_card');
    }
  }

  private handleSagCardRequest(visitor: Visitor, count: number): void {
    this.dialogueClickCounts['are_you_sag'] = count;

    if (count === 1) {
      // First ask: show the card (or lack thereof)
      const responseKey = 'are_you_sag';
      const response = visitor.dialogueResponses[responseKey] ?? '...';
      this.conversationHistory.push({ question: 'Show SAG Card', answer: response });
      this.showSagCardVisual(visitor);
      this.startTalking();
      this.drawDialogue(visitor);
      return;
    }

    if (count === 2 && !visitor.sagCard) {
      // Second ask with no card: they offer a bribe to make it go away
      const bribeAmount = randomInt(20, 60);
      const response = `*leans in* Look, I don't have my card on me. What if I made it worth your while? $${bribeAmount}, just between us.`;
      this.conversationHistory.push({ question: 'Show SAG Card', answer: response });

      // Create a bribe offer if they don't already have one
      if (!visitor.bribeOffer) {
        visitor.bribeOffer = { amount: bribeAmount, dialogue: response };
      }
      this.startTalking();
      this.drawDialogue(visitor);
      return;
    }

    // Subsequent asks: they get defensive / the player caught them
    if (count >= 2) {
      this.playerKnowsLie = true;
      const caughtResponses = [
        '*voice cracks* I told you, it\'s... being processed.',
        '*won\'t make eye contact* Can we talk about something else?',
        '*getting angry* What is this, an interrogation?!',
        '*sweating* My agent handles all that stuff. Call him.',
      ];
      const response = visitor.dialogueResponses[`are_you_sag_${count}`]
        ?? caughtResponses[(count - 2) % caughtResponses.length];
      this.conversationHistory.push({ question: 'Show SAG Card', answer: response });
      this.startTalking();
      this.drawDialogue(visitor);
    }
  }

  private checkForLieHint(visitor: Visitor, questionKey: string, count: number): boolean {
    // Check if this question touches on something wrong with the visitor
    const isFaker = !visitor.canDoTheJob || !visitor.isStuntPerformer;

    if (questionKey === 'where_are_you_from' && !visitor.isLocal) {
      if (count >= 2) {
        this.playerKnowsLie = true;
        this.visitorTells.push('not_local');
      }
      return true;
    }

    if (questionKey === 'tell_me_about_experience' && isFaker && !visitor.isStuntPerformer) {
      if (count >= 2) {
        this.playerKnowsLie = true;
        this.visitorTells.push('not_stunt_performer');
      }
      return true;
    }

    if (questionKey === 'about_your_reel' && visitor.skillReel) {
      // Check if their reel name doesn't match
      if (visitor.skillReel.titleCardName !== visitor.name) {
        if (count >= 1) {
          this.visitorTells.push('stolen_reel');
        }
        return true;
      }
    }

    return false;
  }

  private lookUpBook(visitor: Visitor): void {
    if (!this.bookResultText) return;

    const listing = this.bookSystem.lookupPerformer(visitor.name, this.bookListings);

    if (listing) {
      // Dot-matrix printer animation — print one line at a time
      const lines = [
        `${listing.name}`,
        `${listing.height}  ${listing.weight} lbs`,
        `${listing.city}`,
      ];
      this.animatePrinterOutput(lines, '#4a7a4f');
    } else {
      this.animatePrinterOutput(['SEARCHING...', '', 'NO RECORD.', 'That\'s strange.'], '#c4553a');
      this.visitorTells.push('not_in_book');
    }
  }

  private animatePrinterOutput(lines: string[], color: string): void {
    if (!this.bookResultText) return;
    this.bookResultText.setText('');
    this.bookResultText.setColor(color);

    let currentText = '>>> SEARCHING...\n';
    this.bookResultText.setText(currentText);

    // Print each line with a delay, dot-matrix style
    let lineIndex = 0;
    const printNextLine = () => {
      if (lineIndex >= lines.length || !this.bookResultText) return;

      const line = lines[lineIndex];
      if (line === '') {
        currentText += '\n';
      } else {
        currentText += `${line}\n`;
      }
      this.bookResultText.setText(currentText);
      lineIndex++;

      if (lineIndex < lines.length) {
        this.time.delayedCall(250, printNextLine);
      }
    };

    // Start printing after "searching" delay
    this.time.delayedCall(400, () => {
      if (!this.bookResultText) return;
      currentText = '';
      printNextLine();
    });
  }

  private playReel(visitor: Visitor): void {
    if (!this.reelDisplayText || !visitor.skillReel) return;
    this.reelAnimating = true;
    this.reelAnimFrame = 0;
    this.reelAnimElapsed = 0;
    this.pendingReelVisitor = visitor;
    this.reelDisplayText.setText('\u25b6 PLAYING...');
    this.reelDisplayText.setColor('#e8c36a');
  }

  private showReelResult(): void {
    const visitor = this.pendingReelVisitor;
    if (!visitor?.skillReel) return;
    const reel = visitor.skillReel;
    const state = this.gsm.getCurrentState();

    const dupCheck = this.reelSystem.checkForDuplicate(reel, state.seenReels, visitor.name);
    const animation = REEL_ANIMATIONS.find(a => a.id === reel.animationId);
    const animType = animation ? animation.stuntType : 'unknown';
    const bodyMismatch = this.reelSystem.checkBodyTypeMismatch(reel, visitor);

    // Update the small text label
    if (this.reelDisplayText) {
      this.reelDisplayText.setText(animType.replace(/_/g, ' ').toUpperCase());
      if (dupCheck.isDuplicate) {
        this.reelDisplayText.setColor('#c4553a');
      } else if (bodyMismatch) {
        this.reelDisplayText.setColor('#e8c36a');
      } else {
        this.reelDisplayText.setColor('#d4c5a0');
      }
    }

    // Draw visual reel in the monitor area
    this.drawReelVisual(animType, reel.titleCardName, dupCheck.isDuplicate, bodyMismatch, dupCheck.originalOwner ?? null);

    if (dupCheck.isDuplicate) {
      this.showDuplicateReelCallout(visitor, dupCheck.originalOwner!);
    }

    this.reelSystem.recordReel(reel, visitor.name, state.seenReels);
    this.pendingReelVisitor = null;
  }

  private drawReelVisual(rawStuntType: string, titleName: string, isDuplicate: boolean, bodyMismatch: boolean, dupOwner: string | null): void {
    // Normalize stunt type — handle both underscore and space variants
    const stuntType = rawStuntType.replace(/ /g, '_');
    // Draw inside the reel monitor area (in bottomHalfContainer)
    const reelGfx = this.add.graphics();
    this.bottomHalfContainer.add(reelGfx);

    // Monitor inner bounds (from drawBookAndReel - px=544, reelY=580)
    const mx = 548;
    const my = 602;
    const mw = 218;
    const mh = 54;

    // VHS blue background
    reelGfx.fillStyle(0x0a0a2a, 1);
    reelGfx.fillRect(mx, my, mw, mh);

    // VHS tracking lines
    reelGfx.fillStyle(0x1a1a4a, 0.5);
    for (let i = 0; i < 4; i++) {
      reelGfx.fillRect(mx, my + randomInt(0, mh), mw, 1);
    }

    // Draw stunt figure based on type
    const figX = mx + mw / 2;
    const figY = my + 28;

    // Ground line
    reelGfx.fillStyle(0x2a2a5a, 0.8);
    reelGfx.fillRect(mx + 10, my + 50, mw - 20, 1);

    // Stick figure performing stunt
    reelGfx.fillStyle(0xd4c5a0, 0.9);

    if (stuntType === 'fight') {
      // Fighting pose - two figures
      reelGfx.fillCircle(figX - 20, figY - 8, 4);
      reelGfx.fillRect(figX - 21, figY - 4, 3, 14);
      reelGfx.fillRect(figX - 18, figY, 18, 2); // punch arm
      reelGfx.fillCircle(figX + 15, figY - 6, 4);
      reelGfx.fillRect(figX + 14, figY - 2, 3, 14);
      // Impact star
      reelGfx.fillStyle(0xf5d799, 0.8);
      reelGfx.fillCircle(figX, figY, 3);
    } else if (stuntType === 'high_fall' || stuntType === 'stair_fall') {
      // Falling figure
      reelGfx.fillCircle(figX, figY - 15, 4);
      reelGfx.fillRect(figX - 1, figY - 11, 3, 12);
      reelGfx.fillRect(figX - 8, figY - 8, 6, 2);
      reelGfx.fillRect(figX + 2, figY - 6, 6, 2);
      reelGfx.fillRect(figX - 5, figY + 1, 2, 8);
      reelGfx.fillRect(figX + 3, figY + 1, 2, 8);
      // Arrow showing fall direction
      reelGfx.fillStyle(0xc4553a, 0.6);
      reelGfx.fillTriangle(figX + 15, figY + 10, figX + 12, figY + 4, figX + 18, figY + 4);
      reelGfx.fillRect(figX + 14, figY - 4, 3, 8);
    } else if (stuntType === 'car_hit') {
      // Figure flying through air after car hit
      reelGfx.fillCircle(figX + 10, figY - 10, 4);
      reelGfx.fillRect(figX + 9, figY - 6, 3, 10);
      reelGfx.fillRect(figX + 5, figY - 4, 5, 2);
      reelGfx.fillRect(figX + 12, figY - 2, 5, 2);
      // Car shape
      reelGfx.fillStyle(0x4a4a6a, 0.8);
      reelGfx.fillRect(figX - 30, figY + 2, 30, 12);
      reelGfx.fillRect(figX - 25, figY - 6, 20, 8);
      // Wheels
      reelGfx.fillStyle(0x1a1a2a, 1);
      reelGfx.fillCircle(figX - 24, figY + 14, 3);
      reelGfx.fillCircle(figX - 8, figY + 14, 3);
    } else if (stuntType === 'fire_gag') {
      // Figure with flames
      reelGfx.fillCircle(figX, figY - 8, 4);
      reelGfx.fillRect(figX - 1, figY - 4, 3, 14);
      reelGfx.fillRect(figX - 6, figY - 2, 4, 2);
      reelGfx.fillRect(figX + 3, figY - 2, 4, 2);
      // Flames around figure
      reelGfx.fillStyle(0xe8a030, 0.7);
      reelGfx.fillTriangle(figX - 5, figY - 12, figX - 8, figY + 4, figX - 2, figY + 4);
      reelGfx.fillTriangle(figX + 5, figY - 14, figX + 2, figY + 2, figX + 8, figY + 2);
      reelGfx.fillStyle(0xc44020, 0.5);
      reelGfx.fillTriangle(figX, figY - 16, figX - 4, figY - 4, figX + 4, figY - 4);
    } else if (stuntType === 'wire_work') {
      // Figure suspended on wire
      reelGfx.lineStyle(1, 0x8a8a9a, 0.6);
      reelGfx.lineBetween(figX, my + 2, figX, figY - 12);
      reelGfx.fillStyle(0xd4c5a0, 0.9);
      reelGfx.fillCircle(figX, figY - 8, 4);
      reelGfx.fillRect(figX - 1, figY - 4, 3, 12);
      // Arms out like flying
      reelGfx.fillRect(figX - 10, figY - 2, 8, 2);
      reelGfx.fillRect(figX + 3, figY - 2, 8, 2);
      // Legs trailing
      reelGfx.fillRect(figX - 3, figY + 8, 2, 6);
      reelGfx.fillRect(figX + 2, figY + 8, 2, 6);
    } else if (stuntType === 'ratchet_pull' || stuntType === 'ratchet pull') {
      // Figure being yanked sideways by a cable — flying through the air
      reelGfx.lineStyle(1, 0x8a8a9a, 0.6);
      reelGfx.lineBetween(mx + mw - 5, figY, figX + 8, figY - 2); // cable
      reelGfx.fillStyle(0xd4c5a0, 0.9);
      // Figure horizontal, being pulled right
      reelGfx.fillCircle(figX + 6, figY - 4, 4); // head
      reelGfx.fillRect(figX - 8, figY - 2, 16, 3); // body horizontal
      // Arms trailing behind
      reelGfx.fillRect(figX - 14, figY - 4, 6, 2);
      reelGfx.fillRect(figX - 12, figY, 6, 2);
      // Legs trailing
      reelGfx.fillRect(figX - 14, figY + 2, 2, 6);
      reelGfx.fillRect(figX - 10, figY + 2, 2, 6);
      // Motion lines
      reelGfx.lineStyle(1, 0xd4c5a0, 0.3);
      reelGfx.lineBetween(figX - 20, figY - 6, figX - 30, figY - 6);
      reelGfx.lineBetween(figX - 18, figY, figX - 28, figY);
      reelGfx.lineBetween(figX - 22, figY + 6, figX - 32, figY + 6);
    } else if (stuntType === 'explosion_reaction') {
      // Figure being blown back
      reelGfx.fillCircle(figX + 12, figY - 6, 4);
      reelGfx.fillRect(figX + 11, figY - 2, 3, 12);
      // Explosion
      reelGfx.fillStyle(0xe8a030, 0.6);
      reelGfx.fillCircle(figX - 10, figY, 12);
      reelGfx.fillStyle(0xc44020, 0.4);
      reelGfx.fillCircle(figX - 10, figY, 8);
      reelGfx.fillStyle(0xf5d799, 0.5);
      reelGfx.fillCircle(figX - 10, figY, 4);
    } else if (stuntType === 'fire_run') {
      // Running figure on fire
      reelGfx.fillCircle(figX + 5, figY - 10, 4);
      reelGfx.fillRect(figX + 4, figY - 6, 3, 12);
      // Running legs
      reelGfx.fillRect(figX, figY + 6, 2, 8);
      reelGfx.fillRect(figX + 8, figY + 4, 2, 8);
      // Arms pumping
      reelGfx.fillRect(figX - 2, figY - 4, 6, 2);
      reelGfx.fillRect(figX + 6, figY - 1, 6, 2);
      // Flames trailing behind
      reelGfx.fillStyle(0xe8a030, 0.7);
      reelGfx.fillTriangle(figX - 8, figY - 14, figX - 14, figY + 2, figX - 4, figY + 2);
      reelGfx.fillTriangle(figX - 4, figY - 16, figX - 10, figY - 2, figX, figY - 2);
      reelGfx.fillStyle(0xc44020, 0.5);
      reelGfx.fillTriangle(figX - 2, figY - 12, figX - 6, figY, figX + 2, figY);
      // Motion lines
      reelGfx.lineStyle(1, 0xd4c5a0, 0.3);
      reelGfx.lineBetween(figX - 15, figY - 6, figX - 22, figY - 6);
      reelGfx.lineBetween(figX - 12, figY + 2, figX - 20, figY + 2);
    } else if (stuntType === 'fight_and_fall') {
      // Fight on a rooftop then falling
      // Two fighters on a ledge
      reelGfx.fillCircle(figX - 12, figY - 10, 3);
      reelGfx.fillRect(figX - 13, figY - 7, 3, 10);
      reelGfx.fillRect(figX - 10, figY - 5, 10, 2); // punch
      reelGfx.fillCircle(figX + 5, figY - 8, 3);
      reelGfx.fillRect(figX + 4, figY - 5, 3, 10);
      // Ledge
      reelGfx.fillStyle(0x4a4a5a, 0.8);
      reelGfx.fillRect(figX - 25, figY + 5, 40, 3);
      // Falling figure below
      reelGfx.fillStyle(0xd4c5a0, 0.7);
      reelGfx.fillCircle(figX + 20, figY + 14, 3);
      reelGfx.fillRect(figX + 19, figY + 17, 3, 8);
      // Fall arrow
      reelGfx.fillStyle(0xc4553a, 0.5);
      reelGfx.fillTriangle(figX + 25, figY + 28, figX + 22, figY + 22, figX + 28, figY + 22);
    } else if (stuntType === 'motorcycle') {
      // Motorcycle sliding
      reelGfx.fillStyle(0x4a4a6a, 0.8);
      reelGfx.fillRect(figX - 18, figY + 4, 24, 8);
      reelGfx.fillRect(figX - 14, figY - 2, 16, 6);
      // Wheels
      reelGfx.fillStyle(0x1a1a2a, 1);
      reelGfx.fillCircle(figX - 14, figY + 12, 4);
      reelGfx.fillCircle(figX + 4, figY + 12, 4);
      // Rider sliding off
      reelGfx.fillStyle(0xd4c5a0, 0.9);
      reelGfx.fillCircle(figX + 16, figY - 4, 4);
      reelGfx.fillRect(figX + 15, figY, 3, 10);
      // Sparks
      reelGfx.fillStyle(0xf5d799, 0.7);
      reelGfx.fillRect(figX - 20, figY + 10, 2, 2);
      reelGfx.fillRect(figX - 24, figY + 8, 2, 2);
      reelGfx.fillRect(figX - 22, figY + 12, 1, 1);
    } else if (stuntType === 'acting') {
      // Close-up face — actor, not stunt performer
      reelGfx.fillStyle(0xc4a882, 0.9);
      reelGfx.fillEllipse(figX, figY, 28, 34);
      // Eyes
      reelGfx.fillStyle(0xffffff, 0.8);
      reelGfx.fillEllipse(figX - 6, figY - 4, 6, 4);
      reelGfx.fillEllipse(figX + 6, figY - 4, 6, 4);
      reelGfx.fillStyle(0x1a1a1a, 1);
      reelGfx.fillCircle(figX - 6, figY - 4, 2);
      reelGfx.fillCircle(figX + 6, figY - 4, 2);
      // Mouth
      reelGfx.fillStyle(0x8a4a3a, 0.6);
      reelGfx.fillEllipse(figX, figY + 8, 10, 5);
    } else {
      // Generic - standing figure
      reelGfx.fillCircle(figX, figY - 8, 4);
      reelGfx.fillRect(figX - 1, figY - 4, 3, 14);
      reelGfx.fillRect(figX - 6, figY - 2, 4, 2);
      reelGfx.fillRect(figX + 3, figY - 2, 4, 2);
      reelGfx.fillRect(figX - 3, figY + 10, 2, 6);
      reelGfx.fillRect(figX + 2, figY + 10, 2, 6);
    }

    // Title card at bottom
    const titleText = this.add.text(mx + 4, my + mh - 14, titleName, {
      fontFamily: 'Courier New, monospace',
      fontSize: '10px',
      color: '#d4c5a0',
    });
    this.bottomHalfContainer.add(titleText);

    // REC indicator
    reelGfx.fillStyle(0xc44020, 0.8);
    reelGfx.fillCircle(mx + mw - 12, my + 8, 3);
    const recText = this.add.text(mx + mw - 8, my + 4, 'REC', {
      fontFamily: 'Courier New, monospace',
      fontSize: '8px',
      color: '#c44020',
    });
    this.bottomHalfContainer.add(recText);

    // Duplicate stamp
    if (isDuplicate) {
      reelGfx.fillStyle(0xc44020, 0.3);
      reelGfx.fillRect(mx, my, mw, mh);
      const dupText = this.add.text(mx + mw / 2, my + mh / 2 - 8, 'DUPLICATE', {
        fontFamily: 'Courier New, monospace',
        fontSize: '14px',
        color: '#ff4444',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      this.bottomHalfContainer.add(dupText);
      if (dupOwner) {
        const ownerText = this.add.text(mx + mw / 2, my + mh / 2 + 6, `Same as ${dupOwner}`, {
          fontFamily: 'Courier New, monospace',
          fontSize: '9px',
          color: '#ff6666',
        }).setOrigin(0.5);
        this.bottomHalfContainer.add(ownerText);
      }
    }

    // Body mismatch warning
    if (bodyMismatch && !isDuplicate) {
      const warnText = this.add.text(mx + mw / 2, my + 4, 'BODY MISMATCH', {
        fontFamily: 'Courier New, monospace',
        fontSize: '9px',
        color: '#e8c36a',
        fontStyle: 'bold',
      }).setOrigin(0.5, 0);
      this.bottomHalfContainer.add(warnText);
    }
  }

  private drawReelAnimFrame(rawStuntType: string, frame: number): void {
    const stuntType = rawStuntType.replace(/ /g, '_');
    // Animate inside the reel monitor area (matches reelY=580)
    const mx = 548;
    const my = 602;
    const mw = 218;
    const mh = 54;

    // Clear previous frame by drawing over it
    const clearGfx = this.add.graphics();
    this.bottomHalfContainer.add(clearGfx);
    clearGfx.fillStyle(0x0a0a2a, 1);
    clearGfx.fillRect(mx, my, mw, mh);

    // VHS tracking lines
    clearGfx.fillStyle(0x1a1a4a, 0.5);
    clearGfx.fillRect(mx, my + randomInt(0, mh), mw, 1);

    const figX = mx + mw / 2;
    const figY = my + 28;
    const phase = frame % 4;

    // Ground line
    clearGfx.fillStyle(0x2a2a5a, 0.8);
    clearGfx.fillRect(mx + 10, my + 50, mw - 20, 1);

    clearGfx.fillStyle(0xd4c5a0, 0.9);

    if (stuntType === 'fight') {
      // Two figures fighting — animate punches
      const punchOffset = phase % 2 === 0 ? 8 : -2;
      clearGfx.fillCircle(figX - 20, figY - 8, 4);
      clearGfx.fillRect(figX - 21, figY - 4, 3, 14);
      clearGfx.fillRect(figX - 18, figY - 2 + (phase % 2) * 4, punchOffset + 10, 2);
      clearGfx.fillCircle(figX + 15, figY - 6 - (phase % 2) * 3, 4);
      clearGfx.fillRect(figX + 14, figY - 2, 3, 14);
      // Impact flash on hit frames
      if (phase === 1) {
        clearGfx.fillStyle(0xf5d799, 0.8);
        clearGfx.fillCircle(figX, figY - 2, 4);
      }
    } else if (stuntType === 'high_fall' || stuntType === 'stair_fall') {
      // Figure falling down over frames
      const fallY = figY - 15 + phase * 8;
      const rotation = phase * 15;
      clearGfx.fillCircle(figX + phase * 2, fallY, 4);
      clearGfx.fillRect(figX - 1 + phase * 2, fallY + 4, 3, 12);
      // Arms flailing
      clearGfx.fillRect(figX - 8 + phase * 3, fallY + 2, 6, 2);
      clearGfx.fillRect(figX + 3 - phase * 2, fallY + 6, 6, 2);
      // Legs
      clearGfx.fillRect(figX - 4 + phase, fallY + 16, 2, 6);
      clearGfx.fillRect(figX + 2 - phase, fallY + 16, 2, 6);
    } else if (stuntType === 'car_hit') {
      // Car approaches then hits figure
      const carX = figX - 40 + phase * 12;
      clearGfx.fillStyle(0x4a4a6a, 0.8);
      clearGfx.fillRect(carX, figY + 2, 30, 12);
      clearGfx.fillRect(carX + 5, figY - 6, 20, 8);
      clearGfx.fillStyle(0x1a1a2a, 1);
      clearGfx.fillCircle(carX + 6, figY + 14, 3);
      clearGfx.fillCircle(carX + 22, figY + 14, 3);
      // Figure getting hit and flying
      clearGfx.fillStyle(0xd4c5a0, 0.9);
      const flyX = figX + 10 + phase * 5;
      const flyY = figY - 8 - phase * 4;
      clearGfx.fillCircle(flyX, flyY, 4);
      clearGfx.fillRect(flyX - 1, flyY + 4, 3, 10);
    } else if (stuntType === 'fire_gag') {
      // Figure on fire — flames animate
      clearGfx.fillCircle(figX, figY - 8, 4);
      clearGfx.fillRect(figX - 1, figY - 4, 3, 14);
      clearGfx.fillRect(figX - 6, figY - 2, 4, 2);
      clearGfx.fillRect(figX + 3, figY - 2, 4, 2);
      // Animated flames
      const flameH = 10 + phase * 3;
      clearGfx.fillStyle(0xe8a030, 0.5 + phase * 0.1);
      clearGfx.fillTriangle(figX - 6, figY - flameH, figX - 10, figY + 4, figX - 2, figY + 4);
      clearGfx.fillTriangle(figX + 6, figY - flameH - 2, figX + 2, figY + 2, figX + 10, figY + 2);
      clearGfx.fillStyle(0xc44020, 0.4 + phase * 0.1);
      clearGfx.fillTriangle(figX, figY - flameH - 4, figX - 4, figY - 4, figX + 4, figY - 4);
    } else if (stuntType === 'wire_work') {
      // Figure swinging on wire
      const swingX = figX + Math.sin(phase * 1.5) * 15;
      clearGfx.lineStyle(1, 0x8a8a9a, 0.6);
      clearGfx.lineBetween(figX, my + 2, swingX, figY - 12);
      clearGfx.fillStyle(0xd4c5a0, 0.9);
      clearGfx.fillCircle(swingX, figY - 8, 4);
      clearGfx.fillRect(swingX - 1, figY - 4, 3, 12);
      clearGfx.fillRect(swingX - 10, figY - 2, 8, 2);
      clearGfx.fillRect(swingX + 3, figY - 2, 8, 2);
    } else if (stuntType === 'ratchet_pull' || stuntType === 'ratchet pull') {
      // Figure yanked across screen by cable — flies from left to right
      const pullX = mx + 10 + phase * (mw / 5);
      clearGfx.lineStyle(1, 0x8a8a9a, 0.6);
      clearGfx.lineBetween(mx + mw - 5, figY, pullX + 8, figY - 2);
      clearGfx.fillStyle(0xd4c5a0, 0.9);
      clearGfx.fillCircle(pullX + 6, figY - 4, 4);
      clearGfx.fillRect(pullX - 8, figY - 2, 16, 3);
      clearGfx.fillRect(pullX - 14 - phase, figY - 4, 6, 2);
      clearGfx.fillRect(pullX - 12 - phase, figY + 1, 6, 2);
      clearGfx.fillRect(pullX - 14, figY + 4, 2, 5);
      clearGfx.fillRect(pullX - 10, figY + 4, 2, 5);
      clearGfx.lineStyle(1, 0xd4c5a0, 0.2 + phase * 0.05);
      for (let ml = 0; ml < 2 + phase; ml++) {
        const ly = figY - 6 + ml * 5;
        clearGfx.lineBetween(pullX - 20 - phase * 3, ly, pullX - 30 - phase * 5, ly);
      }
    } else if (stuntType === 'fire_run') {
      // Running on fire — figure runs across screen with trailing flames
      const runX = figX - 20 + phase * 12;
      clearGfx.fillCircle(runX + 5, figY - 10, 4);
      clearGfx.fillRect(runX + 4, figY - 6, 3, 12);
      // Alternating run legs
      if (phase % 2 === 0) {
        clearGfx.fillRect(runX, figY + 6, 2, 8);
        clearGfx.fillRect(runX + 8, figY + 4, 2, 6);
      } else {
        clearGfx.fillRect(runX + 2, figY + 4, 2, 6);
        clearGfx.fillRect(runX + 6, figY + 6, 2, 8);
      }
      // Pumping arms
      clearGfx.fillRect(runX - 2 + (phase % 2) * 4, figY - 4, 6, 2);
      // Flames growing
      const flameSize = 8 + phase * 2;
      clearGfx.fillStyle(0xe8a030, 0.6);
      clearGfx.fillTriangle(runX - 6, figY - flameSize, runX - 12, figY + 4, runX, figY + 4);
      clearGfx.fillStyle(0xc44020, 0.5);
      clearGfx.fillTriangle(runX - 2, figY - flameSize - 4, runX - 8, figY, runX + 4, figY);
    } else if (stuntType === 'fight_and_fall') {
      // Fight then fall — two phases
      if (phase < 2) {
        // Fighting on rooftop
        clearGfx.fillCircle(figX - 12, figY - 10, 4);
        clearGfx.fillRect(figX - 13, figY - 6, 3, 12);
        const punchX = phase === 0 ? 10 : 14;
        clearGfx.fillRect(figX - 10, figY - 4, punchX, 2);
        clearGfx.fillCircle(figX + 8, figY - 8, 4);
        clearGfx.fillRect(figX + 7, figY - 4, 3, 12);
        // Ledge
        clearGfx.fillStyle(0x4a4a5a, 0.8);
        clearGfx.fillRect(figX - 25, figY + 8, 50, 3);
      } else {
        // Falling
        const fallY = figY - 10 + (phase - 2) * 10;
        clearGfx.fillCircle(figX, fallY, 4);
        clearGfx.fillRect(figX - 1, fallY + 4, 3, 10);
        clearGfx.fillRect(figX - 8, fallY + 2 + phase, 6, 2);
        clearGfx.fillRect(figX + 3, fallY + 6 - phase, 6, 2);
        // Ledge above
        clearGfx.fillStyle(0x4a4a5a, 0.6);
        clearGfx.fillRect(figX - 25, figY - 10, 50, 3);
      }
    } else if (stuntType === 'motorcycle') {
      // Motorcycle sliding — bike slides, rider separates
      const slideX = figX - 25 + phase * 8;
      clearGfx.fillStyle(0x4a4a6a, 0.8);
      clearGfx.fillRect(slideX, figY + 4, 22, 7);
      clearGfx.fillRect(slideX + 4, figY - 1, 14, 5);
      clearGfx.fillStyle(0x1a1a2a, 1);
      clearGfx.fillCircle(slideX + 4, figY + 11, 3);
      clearGfx.fillCircle(slideX + 18, figY + 11, 3);
      // Sparks
      clearGfx.fillStyle(0xf5d799, 0.8);
      for (let sp = 0; sp < 3; sp++) {
        clearGfx.fillRect(slideX - 4 - sp * 5, figY + 10 + randomInt(-2, 2), 2, 2);
      }
      // Rider rolling away
      clearGfx.fillStyle(0xd4c5a0, 0.9);
      const riderX = slideX + 24 + phase * 3;
      clearGfx.fillCircle(riderX, figY - 2 + (phase % 2) * 4, 4);
      clearGfx.fillRect(riderX - 1, figY + 2 + (phase % 2) * 2, 3, 8);
    } else if (stuntType === 'acting') {
      // Actor close-up — face with changing expressions
      clearGfx.fillStyle(0xc4a882, 0.9);
      clearGfx.fillEllipse(figX, figY, 28, 34);
      clearGfx.fillStyle(0x1a1a1a, 1);
      const eyeOpen = phase % 3 !== 2;
      if (eyeOpen) {
        clearGfx.fillCircle(figX - 6, figY - 4, 2);
        clearGfx.fillCircle(figX + 6, figY - 4, 2);
      } else {
        clearGfx.fillRect(figX - 8, figY - 4, 4, 1);
        clearGfx.fillRect(figX + 4, figY - 4, 4, 1);
      }
      clearGfx.fillStyle(0x8a4a3a, 0.6);
      if (phase === 0) clearGfx.fillEllipse(figX, figY + 8, 8, 2);
      else if (phase === 1) clearGfx.fillEllipse(figX, figY + 8, 10, 5);
      else if (phase === 2) clearGfx.fillEllipse(figX, figY + 8, 6, 6);
      else clearGfx.fillEllipse(figX, figY + 8, 8, 3);
    } else {
      // Generic standing figure
      clearGfx.fillCircle(figX, figY - 8, 4);
      clearGfx.fillRect(figX - 1, figY - 4, 3, 14);
      clearGfx.fillRect(figX - 6, figY - 2, 4, 2);
      clearGfx.fillRect(figX + 3, figY - 2, 4, 2);
      clearGfx.fillRect(figX - 3, figY + 10, 2, 6);
      clearGfx.fillRect(figX + 2, figY + 10, 2, 6);
    }

    // REC indicator blinks
    if (phase % 2 === 0) {
      clearGfx.fillStyle(0xc44020, 0.8);
      clearGfx.fillCircle(mx + mw - 12, my + 8, 3);
    }
  }

  private showDuplicateReelCallout(visitor: Visitor, originalOwner: string): void {
    const calloutBg = this.add.graphics();
    this.bottomHalfContainer.add(calloutBg);
    calloutBg.fillStyle(0x3a1a1a, 1);
    calloutBg.fillRoundedRect(540, 720, 200, 22, 3);
    calloutBg.lineStyle(1, 0xc4553a, 1);
    calloutBg.strokeRoundedRect(540, 720, 200, 22, 3);

    const calloutBtn = this.add.text(548, 723, 'CALL OUT DUPLICATE', {
      fontFamily: 'Courier New, monospace',
      fontSize: '12px',
      color: '#e06050',
      fontStyle: 'bold',
    }).setInteractive({ useHandCursor: true });
    this.bottomHalfContainer.add(calloutBtn);

    calloutBtn.on('pointerdown', () => {
      this.idleTimer = 0;
      const state = this.gsm.getCurrentState();
      const repGain = BALANCE.repGain.caught_duplicate_reel ?? 2;
      this.gsm.updateState({
        reputation: Math.max(0, Math.min(100, state.reputation + repGain)),
      });

      this.showVisitorResponse(`You caught ${visitor.name} using ${originalOwner}'s reel. They leave quickly.`);

      this.rejections.push({
        visitorId: visitor.id,
        visitorName: visitor.name,
        wasFaker: true,
        wasReturning: visitor.isReturning,
      });

      this.hireResults.push({
        visitorId: visitor.id,
        visitorName: visitor.name,
        roleId: '',
        roleTitle: '(caught duplicate reel)',
        outcome: 'caught_duplicate_reel',
        outcomeDetail: `Caught using ${originalOwner}'s reel. Busted.`,
        repChange: repGain,
        fine: 0,
        wasInjured: false,
        injury: null,
      });

      calloutBtn.destroy();
      calloutBg.destroy();
      this.drawStatusBar();
      this.time.delayedCall(600, () => this.nextVisitor());
    });
  }

  private handleBribe(visitor: Visitor, accept: boolean): void {
    if (!visitor.bribeOffer || this.bribeAccepted) return;
    this.idleTimer = 0;

    if (accept) {
      this.bribeAccepted = true;
      this.bribesTaken++;
      this.bribeMoney += visitor.bribeOffer.amount;
      const state = this.gsm.getCurrentState();
      this.moneySystem.acceptBribe(state, visitor.bribeOffer.amount);
      this.showVisitorResponse(`[You pocket $${visitor.bribeOffer.amount}]`);
      this.drawStatusBar();
    } else {
      this.showVisitorResponse('[You push the envelope back.]');
    }
  }

  private showRolePicker(visitor: Visitor): void {
    this.overlayContainer.removeAll(true);

    const gfx = this.add.graphics();
    this.overlayContainer.add(gfx);

    gfx.fillStyle(0x0a0a0f, 0.92);
    gfx.fillRoundedRect(100, 180, 600, 520, 6);
    gfx.lineStyle(2, 0x8a7a50, 0.8);
    gfx.strokeRoundedRect(100, 180, 600, 520, 6);

    const title = this.add.text(400, 210, 'ASSIGN TO ROLE:', {
      fontFamily: 'Courier New, monospace',
      fontSize: '28px',
      color: '#d4c5a0',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.overlayContainer.add(title);

    const unfilledRoles = this.roles.filter(r => r.filledBy === null);

    if (unfilledRoles.length === 0) {
      const noRoles = this.add.text(400, 380, 'No open roles.', {
        fontFamily: 'Courier New, monospace',
        fontSize: '20px',
        color: '#6a6050',
      }).setOrigin(0.5);
      this.overlayContainer.add(noRoles);
    } else {
      unfilledRoles.forEach((role, i) => {
        const ry = 270 + i * 70;
        const riskColors: Record<string, string> = {
          high: '#c4553a',
          medium: '#e8c36a',
          nd: '#4a7a4f',
        };

        const genderReq = role.requiredGender !== 'any' ? ` [${role.requiredGender.toUpperCase()}]` : '';
        const skillsReq = role.requiredSkills.length > 0
          ? role.requiredSkills.map(s => s.replace(/_/g, ' ')).join(', ')
          : 'none';
        const heightReq = `${Math.floor(role.heightRange[0] / 12)}'${role.heightRange[0] % 12}"-${Math.floor(role.heightRange[1] / 12)}'${role.heightRange[1] % 12}"`;
        const weightReq = `${role.weightRange[0]}-${role.weightRange[1]}lb`;

        // Role button background
        const roleBg = this.add.graphics();
        this.overlayContainer.add(roleBg);
        roleBg.fillStyle(0x1a1816, 0.9);
        roleBg.fillRoundedRect(125, ry - 4, 550, 60, 3);
        roleBg.lineStyle(1, 0x2a2a36, 0.6);
        roleBg.strokeRoundedRect(125, ry - 4, 550, 60, 3);

        const roleBtn = this.add.text(140, ry,
          `${role.title}  [${role.riskLevel.toUpperCase()}]${genderReq}`, {
          fontFamily: 'Courier New, monospace',
          fontSize: '24px',
          color: riskColors[role.riskLevel] ?? '#d4c5a0',
          fontStyle: 'bold',
        }).setInteractive({ useHandCursor: true });

        const reqText = this.add.text(155, ry + 32,
          `Needs: ${skillsReq} | ${heightReq} ${weightReq}${role.sagRequired ? ' | SAG REQ' : ''}`, {
          fontFamily: 'Courier New, monospace',
          fontSize: '16px',
          color: '#6a6050',
        });

        roleBtn.on('pointerdown', () => {
          this.hireVisitor(visitor, role);
          this.overlayContainer.removeAll(true);
        });

        this.overlayContainer.add(roleBtn);
        this.overlayContainer.add(reqText);
      });
    }

    // Cancel button
    const cancelBg = this.add.graphics();
    this.overlayContainer.add(cancelBg);
    cancelBg.fillStyle(0x2a2a30, 1);
    cancelBg.fillRoundedRect(350, 565, 100, 26, 4);
    cancelBg.lineStyle(1, 0x4a4a56, 1);
    cancelBg.strokeRoundedRect(350, 565, 100, 26, 4);

    const cancelBtn = this.add.text(400, 578, 'CANCEL', {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      color: '#888070',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    cancelBtn.on('pointerdown', () => {
      this.overlayContainer.removeAll(true);
    });
    this.overlayContainer.add(cancelBtn);
  }

  private hireVisitor(visitor: Visitor, role: Role): void {
    role.filledBy = visitor.id;
    visitor.assignedRoleId = role.id;

    // Accept bribe now that they're actually hired
    if (visitor.bribeOffer && !this.bribeAccepted && !this.bribeRefused) {
      this.handleBribe(visitor, true);
    }

    const outcome = this.determineHireOutcome(visitor, role);

    const state = this.gsm.getCurrentState();
    const { repChange, strike } = this.reputationSystem.applyHireResult(outcome, state);

    let wasInjured = false;
    let injury: Injury | null = null;

    const isFaker = !visitor.canDoTheJob || !visitor.isStuntPerformer;
    if (isFaker) {
      let injuryChance = 0;
      if (role.riskLevel === 'high') {
        injuryChance = BALANCE.fakerInjuryChance;
      } else if (role.riskLevel === 'medium') {
        injuryChance = BALANCE.fakerInjuryChance;
      } else if (role.wasUpgraded) {
        injuryChance = BALANCE.fakerInjuryChance;
      } else {
        injuryChance = BALANCE.ndInjuryChance;
      }

      wasInjured = Math.random() < injuryChance;
    } else {
      wasInjured = false; // legit performers don't get hurt
    }

    if (wasInjured) {
      const severity = role.riskLevel === 'high' ? 'serious' : 'minor';
      injury = {
        visitorId: visitor.id,
        visitorName: visitor.name,
        roleId: role.id,
        roleTitle: role.title,
        severity,
        description: severity === 'serious'
          ? `${visitor.name} was seriously injured during ${role.title}. Production halted.`
          : `${visitor.name} sustained minor injuries during ${role.title}.`,
      };
      state.injuryLog.push(injury);
    }

    const outcomeDetail = this.getSpecificOutcomeDetail(visitor, role, outcome);

    // Calculate fine — deducted from paycheck
    const fine = (BALANCE.fines as Record<string, number>)[outcome] ?? 0;

    const result: HireResult = {
      visitorId: visitor.id,
      visitorName: visitor.name,
      roleId: role.id,
      roleTitle: role.title,
      outcome,
      outcomeDetail,
      repChange,
      fine,
      wasInjured,
      injury,
    };

    this.hireResults.push(result);
    this.drawStatusBar();

    this.showVisitorResponse(`[${visitor.name} assigned to ${role.title}]`);
    this.time.delayedCall(600, () => this.nextVisitor());
  }

  private determineHireOutcome(visitor: Visitor, role: Role): HireOutcome {
    const isFaker = !visitor.canDoTheJob || !visitor.isStuntPerformer;

    // Check locals-only rule (applies from Night 2 onward)
    if (this.nightConfig.noteType === 'locals_only' && !visitor.isLocal) {
      return 'not_local';
    }

    if (role.sagRequired) {
      const sagValid = visitor.sagCard?.valid === true && visitor.resume.sagStatus === 'current';
      if (!sagValid) {
        return 'non_sag_on_sag_night';
      }
    }

    if (isFaker) {
      if (role.wasUpgraded) {
        return 'wrong_hire_upgraded_nd_injury';
      }
      switch (role.riskLevel) {
        case 'high': return 'wrong_hire_high_serious_injury';
        case 'medium': return 'wrong_hire_medium_injury';
        case 'nd': {
          const minorChance = Math.random() < BALANCE.ndInjuryChance;
          return minorChance ? 'wrong_hire_nd_minor_injury' : 'wrong_hire_nd_no_injury';
        }
      }
    }

    const heightFit = visitor.bodyType.height >= role.heightRange[0] && visitor.bodyType.height <= role.heightRange[1];
    const weightFit = visitor.bodyType.weight >= role.weightRange[0] && visitor.bodyType.weight <= role.weightRange[1];
    const genderFit = role.requiredGender === 'any' || visitor.gender === role.requiredGender;
    const skillFit = role.requiredSkills.length === 0 ||
      role.requiredSkills.some(s => visitor.resume.skills.includes(s));

    if (heightFit && weightFit && genderFit && skillFit) {
      return 'correct_right_role';
    }

    // Gender mismatch is the worst — wrong look entirely
    if (!genderFit) {
      return 'wrong_gender';
    }

    // Height or weight outside range — visible size mismatch on camera
    if (!heightFit || !weightFit) {
      return 'size_mismatch';
    }

    // Skills don't match but size/gender OK — small penalty
    return 'correct_slight_mismatch';
  }

  private getSpecificOutcomeDetail(visitor: Visitor, role: Role, outcome: HireOutcome): string {
    const vHeight = `${Math.floor(visitor.bodyType.height / 12)}'${visitor.bodyType.height % 12}"`;
    const rHeightLo = `${Math.floor(role.heightRange[0] / 12)}'${role.heightRange[0] % 12}"`;
    const rHeightHi = `${Math.floor(role.heightRange[1] / 12)}'${role.heightRange[1] % 12}"`;
    const heightDiff = visitor.bodyType.height > role.heightRange[1]
      ? visitor.bodyType.height - role.heightRange[1]
      : role.heightRange[0] - visitor.bodyType.height;

    switch (outcome) {
      case 'correct_right_role':
        return 'Good hire. Nailed it.';
      case 'correct_slight_mismatch':
        return 'Close enough. Got the job done.';
      case 'wrong_gender':
        return `We needed a ${role.requiredGender}. You sent us a ${visitor.gender}. The AD is furious.`;
      case 'size_mismatch': {
        const heightFit = visitor.bodyType.height >= role.heightRange[0] && visitor.bodyType.height <= role.heightRange[1];
        const weightFit = visitor.bodyType.weight >= role.weightRange[0] && visitor.bodyType.weight <= role.weightRange[1];
        if (!heightFit) {
          return `${visitor.name} is ${vHeight}. Role needed ${rHeightLo}-${rHeightHi}. That's ${heightDiff}" off. Wardrobe is flipping out.`;
        }
        if (!weightFit) {
          return `${visitor.name} is ${visitor.bodyType.weight} lbs. Role needed ${role.weightRange[0]}-${role.weightRange[1]}. Costume doesn't fit.`;
        }
        return 'Size mismatch. Doesn\'t match the actor.';
      }
      case 'wrong_hire_nd_no_injury':
        if (!visitor.isStuntPerformer) {
          return `${visitor.name} was an actor, not a stunt performer. Got lucky — no one noticed.`;
        }
        return 'Wrong call, but no harm done.';
      case 'wrong_hire_nd_minor_injury':
        if (!visitor.isStuntPerformer) {
          return `${visitor.name} is not a stunt performer. Minor scrapes on set.`;
        }
        return 'Wrong call. Minor scrapes.';
      case 'wrong_hire_medium_injury':
        if (!visitor.isStuntPerformer) {
          return `${visitor.name} was an actor pretending to be a stunt person. Someone got hurt.`;
        }
        return `Bad hire. ${visitor.name} couldn't handle the gag. Someone got hurt.`;
      case 'wrong_hire_high_serious_injury':
        if (!visitor.isStuntPerformer) {
          return `${visitor.name} was NOT a stunt performer. Serious injury. You're in deep trouble.`;
        }
        return `${visitor.name} wasn't qualified for this. Serious injury on set.`;
      case 'wrong_hire_upgraded_nd_injury':
        return `The stunt got upgraded and ${visitor.name} wasn't ready for it. Injury.`;
      case 'non_sag_on_sag_night':
        return `${visitor.name} is not SAG. This is a union call. That's a mistake.`;
      case 'not_local':
        return `${visitor.name}'s SAG card says ${visitor.actualCity}. Production said locals only. You're in trouble.`;
      case 'unfilled_role':
        return `${role.title} went unfilled. The UPM wants a word.`;
      default:
        return outcome;
    }
  }

  private rejectVisitor(visitor: Visitor): void {
    const isFaker = !visitor.canDoTheJob || !visitor.isStuntPerformer;

    this.rejections.push({
      visitorId: visitor.id,
      visitorName: visitor.name,
      wasFaker: isFaker,
      wasReturning: visitor.isReturning,
    });

    // No rep change for rejections (passed_legit = 0, passed_faker = 0)
    const outcome: HireOutcome = isFaker ? 'passed_faker' : 'passed_legit';
    const state = this.gsm.getCurrentState();
    const { repChange } = this.reputationSystem.applyHireResult(outcome, state);

    if (!state.rejectedVisitors.includes(visitor.id)) {
      state.rejectedVisitors.push(visitor.id);
    }

    // Don't add rejected visitors to hireResults — they won't show in results
    this.drawStatusBar();

    // Show their departing dialogue
    const getLostResponse = visitor.dialogueResponses['get_lost'] ?? `*${visitor.name} leaves quietly*`;
    this.showVisitorResponse(getLostResponse);
    this.startTalking('angry');

    // Fade out visitor sprite after 1800ms
    this.time.delayedCall(1800, () => {
      if (this.visitorSpriteContainer) {
        this.tweens.add({
          targets: this.visitorSpriteContainer,
          alpha: 0,
          duration: 600,
          ease: 'Power2',
        });
      }
    });

    this.time.delayedCall(2500, () => this.nextVisitor());
  }

  private nextVisitor(): void {
    this.currentVisitorIndex++;

    if (
      this.currentVisitorIndex === 3 &&
      this.nightConfig.ndUpgradeChance > 0 &&
      this.ndUpgradeSystem.shouldTriggerUpgrade(this.nightConfig)
    ) {
      this.performNdUpgrade();
      return;
    }

    const allRolesFilled = this.roles.every(r => r.filledBy !== null);
    if (allRolesFilled) {
      this.endNight();
      return;
    }

    // If we've run through all visitors, generate more — the queue is endless
    // Only the deadline (clock) ends the night, not running out of people
    if (this.currentVisitorIndex >= this.visitors.length) {
      const state = this.gsm.getCurrentState();
      const extraVisitors = this.visitorGenerator.generateVisitorsForNight(this.nightConfig, state);
      this.visitors.push(...extraVisitors);
    }

    // Brief pause showing empty set before next visitor appears
    this.time.delayedCall(1000, () => {
      this.presentVisitor(this.visitors[this.currentVisitorIndex]);
    });
  }

  private performNdUpgrade(): void {
    const ndRole = this.ndUpgradeSystem.findNDRole(this.roles);

    if (!ndRole) {
      // Generate more visitors if needed
      if (this.currentVisitorIndex >= this.visitors.length) {
        const state = this.gsm.getCurrentState();
        const extraVisitors = this.visitorGenerator.generateVisitorsForNight(this.nightConfig, state);
        this.visitors.push(...extraVisitors);
      }
      // Brief pause showing empty set before next visitor appears
      this.time.delayedCall(1000, () => {
        this.presentVisitor(this.visitors[this.currentVisitorIndex]);
      });
      return;
    }

    const upgraded = this.ndUpgradeSystem.upgradeRole(ndRole);
    const idx = this.roles.findIndex(r => r.id === ndRole.id);
    if (idx >= 0) {
      this.roles[idx] = upgraded;
    }

    this.gsm.updateState({
      ndUpgradeTriggered: true,
      ndUpgradeTarget: ndRole.id,
      roles: this.roles,
    });

    this.showNdUpgradeNotification(upgraded);
  }

  private showNdUpgradeNotification(upgradedRole: Role): void {
    this.overlayContainer.removeAll(true);
    const gfx = this.add.graphics();
    this.overlayContainer.add(gfx);

    gfx.fillStyle(0x0a0a0f, 0.95);
    gfx.fillRoundedRect(100, 300, 600, 200, 6);
    gfx.lineStyle(2, 0xc4553a, 1);
    gfx.strokeRoundedRect(100, 300, 600, 200, 6);

    const title = this.add.text(400, 330, 'STUNT UPGRADE', {
      fontFamily: 'Courier New, monospace',
      fontSize: '22px',
      color: '#c4553a',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.overlayContainer.add(title);

    const upgradeText = this.ndUpgradeSystem.assessUpgradeRisk(upgradedRole);

    const desc = this.add.text(400, 390, upgradeText, {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      color: '#d4c5a0',
      wordWrap: { width: 500 },
      align: 'center',
    }).setOrigin(0.5);
    this.overlayContainer.add(desc);

    const note = this.add.text(400, 440, 'The AD just walked over and told you. Great.', {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      color: '#6a6050',
    }).setOrigin(0.5);
    this.overlayContainer.add(note);

    const okBg = this.add.graphics();
    this.overlayContainer.add(okBg);
    okBg.fillStyle(0x2a2618, 1);
    okBg.fillRoundedRect(370, 468, 60, 26, 4);
    okBg.lineStyle(1, 0x5a4a2a, 1);
    okBg.strokeRoundedRect(370, 468, 60, 26, 4);

    const okBtn = this.add.text(400, 475, 'OK', {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      color: '#e8c36a',
      fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.overlayContainer.add(okBtn);

    okBtn.on('pointerdown', () => {
      this.overlayContainer.removeAll(true);
      if (this.currentVisitorIndex >= this.visitors.length) {
        this.endNight();
      } else {
        this.presentVisitor(this.visitors[this.currentVisitorIndex]);
      }
    });
  }

  private showThoughtBubble(): void {
    const thoughts = [
      "I should've been a dentist.",
      'My back hurts.',
      'Is that coffee still warm?',
      "Bobby would've known what to do.",
      'Rent is due.',
      "How many more tonight?",
      "The pager hasn't gone off in hours.",
      "I think the AD is sleeping in video village.",
      'At least it\'s work.',
      "Six more hours of this.",
    ];

    const text = randomPick(thoughts);

    // Create a proper thought bubble container
    this.thoughtBubble = this.add.container(300, 90);

    const bubbleGfx = this.add.graphics();
    this.thoughtBubble.add(bubbleGfx);

    // Main bubble
    const bw = text.length * 6 + 24;
    bubbleGfx.fillStyle(0x18182a, 0.9);
    bubbleGfx.fillRoundedRect(0, 0, bw, 30, 8);
    bubbleGfx.lineStyle(1, 0x3a3a50, 0.7);
    bubbleGfx.strokeRoundedRect(0, 0, bw, 30, 8);

    // Thought trail - 3 decreasing circles leading down to coordinator's head
    bubbleGfx.fillStyle(0x18182a, 0.7);
    bubbleGfx.fillCircle(bw / 2 + 10, 38, 5);
    bubbleGfx.fillStyle(0x18182a, 0.5);
    bubbleGfx.fillCircle(bw / 2 + 18, 48, 3);
    bubbleGfx.fillStyle(0x18182a, 0.3);
    bubbleGfx.fillCircle(bw / 2 + 24, 56, 2);

    const bubbleText = this.add.text(12, 7, `"${text}"`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '12px',
      color: '#888898',
      fontStyle: 'italic',
    });
    this.thoughtBubble.add(bubbleText);

    this.thoughtBubble.setAlpha(0);

    this.tweens.add({
      targets: this.thoughtBubble,
      alpha: 0.9,
      duration: 500,
      yoyo: true,
      hold: 3000,
      onComplete: () => {
        if (this.thoughtBubble) {
          this.thoughtBubble.destroy();
          this.thoughtBubble = null;
          this.idleTimer = 0;
        }
      },
    });
  }

  private endNight(): void {
    this.nightDone = true;

    const unfilledRoles = this.roles.filter(r => r.filledBy === null);
    unfilledRoles.forEach(role => {
      const outcome: HireOutcome = 'unfilled_role';
      const state = this.gsm.getCurrentState();
      const { repChange } = this.reputationSystem.applyHireResult(outcome, state);

      this.hireResults.push({
        visitorId: '',
        visitorName: '(unfilled)',
        roleId: role.id,
        roleTitle: role.title,
        outcome,
        outcomeDetail: `${role.title} went unfilled. The UPM wants a word.`,
        repChange,
        fine: (BALANCE.fines as Record<string, number>)['unfilled_role'] ?? 0,
        wasInjured: false,
        injury: null,
      });
    });

    let kidExpense = null;
    if (this.nightConfig.kidExpenseChance > 0 && Math.random() < this.nightConfig.kidExpenseChance) {
      const kidExpenses = [
        { description: 'Kid needs new shoes', cost: 30 },
        { description: 'School field trip fee', cost: 15 },
        { description: 'Kid broke his glasses', cost: 45 },
        { description: 'Birthday party gift', cost: 20 },
        { description: 'Doctor visit copay', cost: 25 },
        { description: 'Ex called. "Emergency"', cost: 50 },
        { description: 'Dog ate the remote again', cost: 18 },
        { description: 'Parking ticket (again)', cost: 35 },
        { description: 'VCR ate a rental tape', cost: 12 },
        { description: 'Replaced pager battery', cost: 8 },
        { description: 'Towed from wrong spot', cost: 60 },
        { description: 'Sunglasses sat on', cost: 22 },
        { description: 'Lost bet to grip dept', cost: 20 },
        { description: 'Bought lunch for the PA', cost: 14 },
        { description: 'Late fee at Blockbuster', cost: 6 },
      ];
      kidExpense = randomPick(kidExpenses);
    }

    const totalRepChange = this.hireResults.reduce((sum, r) => sum + r.repChange, 0);
    const totalFines = this.hireResults.reduce((sum, r) => sum + r.fine, 0);
    const injuries = this.hireResults.filter(r => r.injury).map(r => r.injury!);

    const state = this.gsm.getCurrentState();

    const nightResult: NightResult = {
      night: this.night,
      hires: this.hireResults,
      rejections: this.rejections,
      injuries,
      repChange: totalRepChange,
      fines: totalFines,
      moneyEarned: this.reputationSystem.getDayRate(state.reputation),
      moneySpent: 0,
      bribesTaken: this.bribesTaken,
      bribeMoney: this.bribeMoney,
      sagRepVisit: state.sagRepVisited,
      sagRepCost: state.sagRepVisited ? BALANCE.sagRepCost : 0,
      ndUpgraded: state.ndUpgradeTriggered,
      kidExpense,
    };

    this.gsm.updateState({
      tonightKidExpense: kidExpense,
      dayRate: this.reputationSystem.getDayRate(state.reputation),
    });

    const history = [...state.history, nightResult];
    this.gsm.updateState({
      history,
      injuryLog: [...state.injuryLog],
    });

    this.time.delayedCall(500, () => {
      this.scene.start('ResultsScene', {
        night: this.night,
        nightResult,
      });
    });
  }

  // ---- Utility ----

  private formatTime(t: number): string {
    let hour = Math.floor(t);
    const minutes = Math.floor((t - hour) * 60);
    if (hour >= 24) hour -= 24;
    const dh = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    const finalAp = (Math.floor(t) >= 24) ? 'AM' : (hour >= 12 && hour < 24) ? 'PM' : 'AM';
    return `${dh}:${minutes.toString().padStart(2, '0')} ${finalAp}`;
  }
}
