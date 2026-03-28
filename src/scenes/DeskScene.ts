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
  private conversationHistory: { question: string; answer: string }[] = [];

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
    this.grainTimer = 0;
    this.flickerTimer = 0;
    this.flickerInterval = randomInt(5000, 10000);
    this.workLightGfx = null;
    this.showingIntertitle = false;
    this.intertitleContainer = null;
    this.visitorFadeIn = false;
    this.visitorFadeElapsed = 0;
    this.visitorSpriteContainer = null;

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
    if (this.idleTimer > this.idleThreshold && !this.thoughtBubble) {
      this.showThoughtBubble();
    }

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
  }

  // ================================================================
  // TOP HALF: The Dark Film Set (y: 0-280)
  // ================================================================

  private drawTopHalf(): void {
    this.topHalfContainer.removeAll(true);

    // --- Night Sky Gradient ---
    const skyGfx = this.add.graphics();
    this.topHalfContainer.add(skyGfx);

    const skyColors = [
      0x0a0a1a, 0x09091a, 0x080818, 0x070716,
      0x060614, 0x050512, 0x050510, 0x05050c,
      0x05050a, 0x050508,
    ];
    const stripH = 22;
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
    groundGfx.fillRect(0, 220, 800, 60);
    // pavement cracks
    groundGfx.lineStyle(1, 0x1c1c20, 0.4);
    groundGfx.lineBetween(0, 235, 800, 235);
    groundGfx.lineBetween(0, 252, 800, 252);
    groundGfx.lineBetween(0, 268, 800, 268);
    groundGfx.lineStyle(1, 0x1a1a1e, 0.25);
    groundGfx.lineBetween(100, 240, 250, 242);
    groundGfx.lineBetween(500, 256, 700, 255);
    groundGfx.lineBetween(300, 265, 480, 267);

    // --- Equipment Silhouettes ---
    const equipGfx = this.add.graphics();
    this.topHalfContainer.add(equipGfx);
    const eShadow = 0x0d0d14;
    const eDark = 0x101020;

    // C-STAND (left) - vertical pole, horizontal arm, flag/scrim, triangular base with 3 legs
    equipGfx.fillStyle(eShadow, 1);
    equipGfx.fillRect(52, 80, 3, 140);         // vertical pole
    equipGfx.fillRect(40, 80, 30, 3);           // horizontal arm
    equipGfx.fillStyle(eDark, 1);
    equipGfx.fillRect(30, 65, 25, 18);          // flag/scrim rectangle
    // triangular base: 3 legs
    equipGfx.fillStyle(eShadow, 1);
    equipGfx.fillRect(35, 218, 35, 3);          // base bar
    equipGfx.fillRect(53, 218, 2, 5);
    equipGfx.beginPath();
    equipGfx.moveTo(53, 220);
    equipGfx.lineTo(35, 223);
    equipGfx.lineTo(71, 223);
    equipGfx.closePath();
    equipGfx.fillPath();

    // FILM LIGHT ON STAND (left-center) - tall pole, rectangular housing with barn doors, cable
    equipGfx.fillStyle(eShadow, 1);
    equipGfx.fillRect(155, 60, 3, 160);         // tall vertical pole
    equipGfx.fillStyle(eDark, 1);
    equipGfx.fillRect(140, 48, 30, 18);         // light housing
    // barn doors (small rectangles on each side)
    equipGfx.fillStyle(0x141420, 1);
    equipGfx.fillRect(137, 48, 5, 14);          // left barn door
    equipGfx.fillRect(168, 48, 5, 14);          // right barn door
    // cable drooping down
    equipGfx.lineStyle(1, eShadow, 0.7);
    equipGfx.beginPath();
    equipGfx.moveTo(155, 66);
    equipGfx.lineTo(140, 100);
    equipGfx.lineTo(130, 150);
    equipGfx.lineTo(125, 220);
    equipGfx.strokePath();
    // stand base
    equipGfx.fillStyle(eShadow, 1);
    equipGfx.fillRect(140, 218, 30, 3);
    equipGfx.beginPath();
    equipGfx.moveTo(156, 220);
    equipGfx.lineTo(140, 223);
    equipGfx.lineTo(170, 223);
    equipGfx.closePath();
    equipGfx.fillPath();

    // CAMERA ON TRIPOD (right) - box on triangular legs with viewfinder
    equipGfx.fillStyle(eDark, 1);
    equipGfx.fillRect(650, 130, 40, 28);        // camera body
    equipGfx.fillStyle(eShadow, 1);
    equipGfx.fillRect(645, 135, 8, 8);          // viewfinder
    equipGfx.fillRect(690, 132, 10, 6);         // lens shade
    // tripod legs
    equipGfx.lineStyle(2, eShadow, 0.9);
    equipGfx.lineBetween(660, 158, 640, 220);   // left leg
    equipGfx.lineBetween(670, 158, 670, 220);   // center leg
    equipGfx.lineBetween(680, 158, 700, 220);   // right leg

    // APPLE BOXES stacked (far right)
    equipGfx.fillStyle(0x12121c, 1);
    equipGfx.fillRect(740, 195, 40, 18);        // bottom box
    equipGfx.fillStyle(0x101018, 1);
    equipGfx.fillRect(742, 178, 36, 18);        // middle box
    equipGfx.fillStyle(0x0e0e16, 1);
    equipGfx.fillRect(745, 165, 30, 14);        // top box

    // GENERATOR (far left edge) - large rectangle with exhaust pipe
    equipGfx.fillStyle(0x0e0e16, 1);
    equipGfx.fillRect(0, 188, 28, 32);          // generator body
    equipGfx.fillStyle(eShadow, 1);
    equipGfx.fillRect(5, 178, 4, 12);           // exhaust pipe
    // subtle warm glow around generator
    const genGlow = this.add.graphics();
    this.topHalfContainer.add(genGlow);
    genGlow.fillStyle(0xf5a030, 0.015);
    genGlow.fillCircle(14, 200, 40);
    genGlow.fillStyle(0xf5a030, 0.025);
    genGlow.fillCircle(14, 200, 22);

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
  }

  private showIntertitle(): void {
    this.showingIntertitle = true;
    this.intertitleContainer = this.add.container(0, 0);
    this.intertitleContainer.setDepth(50);

    const gfx = this.add.graphics();
    this.intertitleContainer.add(gfx);
    gfx.fillStyle(0x050508, 1);
    gfx.fillRect(0, 0, 800, 600);

    // Subtle work light glow hint
    gfx.fillStyle(0xf5d799, 0.03);
    gfx.fillEllipse(400, 300, 300, 200);

    const titleText = this.add.text(400, 260, 'A few stunties are\nhere to hustle you.', {
      fontFamily: 'Courier New, monospace',
      fontSize: '28px',
      color: '#d4c5a0',
      align: 'center',
      lineSpacing: 8,
    }).setOrigin(0.5);
    this.intertitleContainer.add(titleText);

    const continueText = this.add.text(400, 380, '[ TAP TO CONTINUE ]', {
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
    const cy = 250;
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
    this.workLightGfx!.fillEllipse(cx, 260, 320, 30);
  }

  private drawCoordinator(): void {
    const gfx = this.add.graphics();
    this.topHalfContainer.add(gfx);

    const cx = 400;
    const chairY = 155;

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
    const ty = 210;
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

    const figCount = Math.min(queueCount, 5);
    for (let i = 0; i < figCount; i++) {
      const qx = 80 + i * 28;
      const qy = 145 - i * 8;
      const alphaFade = 0.9 - i * 0.15;
      const heightVar = randomInt(-3, 3);

      // Body rectangle
      gfx.fillStyle(0x16161e, alphaFade);
      gfx.fillRect(qx - 8, qy + heightVar, 16, 42);
      // Head circle
      gfx.fillCircle(qx, qy - 8 + heightVar, 7);
      // Legs (two thin rects)
      gfx.fillRect(qx - 6, qy + 42 + heightVar, 5, 16);
      gfx.fillRect(qx + 1, qy + 42 + heightVar, 5, 16);
    }
  }

  private drawTimeDisplay(): void {
    const timeStr = this.formatTime(this.gsm.getCurrentState().timeOfNight);

    // Dark panel behind time
    const panelGfx = this.add.graphics();
    this.topHalfContainer.add(panelGfx);
    panelGfx.fillStyle(0x0a0a12, 0.7);
    panelGfx.fillRoundedRect(690, 6, 100, 26, 4);
    panelGfx.lineStyle(1, 0x2a2a36, 0.5);
    panelGfx.strokeRoundedRect(690, 6, 100, 26, 4);

    const timeText = this.add.text(740, 12, timeStr, {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      color: '#a09880',
    }).setOrigin(0.5, 0);
    this.topHalfContainer.add(timeText);
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
    const vy = 105;
    const s = 2.2; // scale factor
    const isMale = this.currentVisitor.gender === 'male';
    const bodyColor = isMale ? 0x4a5a7a : 0x7a4a6a;
    const skinColor = 0xc4a882;
    const skinShadow = 0xa08862;
    const hairColor = isMale ? 0x2a2222 : 0x3a2a22;

    // Shadow on ground
    gfx.fillStyle(0x000000, 0.25);
    gfx.fillEllipse(vx, vy + 76*s, 40*s, 12*s);

    // Shoes
    gfx.fillStyle(0x1a1a22, 1);
    gfx.fillRect(vx - 12*s, vy + 68*s, 10*s, 5*s);
    gfx.fillRect(vx + 2*s, vy + 68*s, 10*s, 5*s);

    // Legs
    gfx.fillStyle(0x2a2a38, 1);
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
    gfx.fillStyle(isMale ? 0x5a6a8a : 0x8a5a7a, 1);
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

    // Hair
    gfx.fillStyle(hairColor, 1);
    if (isMale) {
      gfx.fillEllipse(vx, vy - 22*s, 26*s, 14*s);
      gfx.fillRect(vx - 12*s, vy - 18*s, 3*s, 10*s);
      gfx.fillRect(vx + 9*s, vy - 18*s, 3*s, 10*s);
    } else {
      gfx.fillEllipse(vx, vy - 22*s, 28*s, 16*s);
      gfx.fillRect(vx - 13*s, vy - 20*s, 4*s, 26*s);
      gfx.fillRect(vx + 9*s, vy - 20*s, 4*s, 26*s);
    }

    // Eyes
    gfx.fillStyle(0xffffff, 0.9);
    gfx.fillEllipse(vx - 5*s, vy - 12*s, 5*s, 3*s);
    gfx.fillEllipse(vx + 5*s, vy - 12*s, 5*s, 3*s);
    gfx.fillStyle(0x1a1a1a, 1);
    gfx.fillCircle(vx - 5*s, vy - 12*s, 1.5*s);
    gfx.fillCircle(vx + 5*s, vy - 12*s, 1.5*s);

    // Nose
    gfx.fillStyle(skinShadow, 0.5);
    gfx.fillTriangle(vx, vy - 8*s, vx - 2*s, vy - 4*s, vx + 2*s, vy - 4*s);

    // Mouth
    gfx.fillStyle(0x8a5a4a, 0.6);
    gfx.fillEllipse(vx, vy - 2*s, 6*s, 2*s);
  }

  // ================================================================
  // STATUS BAR (y: 560-600)
  // ================================================================

  private drawStatusBar(): void {
    this.statusBar.removeAll(true);
    const gfx = this.add.graphics();
    this.statusBar.add(gfx);

    // Dark panel background
    gfx.fillStyle(0x0d0d12, 1);
    gfx.fillRect(0, 560, 800, 40);
    // Thin gold top border
    gfx.lineStyle(1, 0x8a7a50, 1);
    gfx.lineBetween(0, 560, 800, 560);

    const state = this.gsm.getCurrentState();
    const filledCount = this.roles.filter(r => r.filledBy !== null).length;
    const totalRoles = this.roles.length;
    const timeStr = this.formatTime(state.timeOfNight);

    // Night info
    const nightLabel = this.add.text(16, 568, `NIGHT ${this.night}/7`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      color: '#d4c5a0',
      fontStyle: 'bold',
    });
    this.statusBar.add(nightLabel);

    // Time
    const timeLabel = this.add.text(130, 568, timeStr, {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      color: '#d4c5a0',
    });
    this.statusBar.add(timeLabel);

    // Roles
    const rolesLabel = this.add.text(240, 568, `Roles: ${filledCount}/${totalRoles}`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      color: '#d4c5a0',
    });
    this.statusBar.add(rolesLabel);

    // Money in gold
    const moneyLabel = this.add.text(400, 568, `$${state.money}`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: '#e8c36a',
      fontStyle: 'bold',
    });
    this.statusBar.add(moneyLabel);

    // Coffee cup icon + depleting level
    const coffeeX = 490;
    const coffeeY = 567;
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

    // Rep bar
    const barX = 540;
    const barY = 569;
    const barW = 150;
    const barH = 12;

    // Dark background for bar
    gfx.fillStyle(0x1a1a22, 1);
    gfx.fillRect(barX, barY, barW, barH);
    gfx.lineStyle(1, 0x2a2a36, 1);
    gfx.strokeRect(barX, barY, barW, barH);

    const repFill = Math.max(0, Math.min(100, state.reputation)) / 100;
    const repColor = state.reputation >= 70 ? 0x4a7a4f : state.reputation >= 40 ? 0x7a6a3a : 0xc4553a;
    gfx.fillStyle(repColor, 1);
    gfx.fillRect(barX + 1, barY + 1, (barW - 2) * repFill, barH - 2);

    const repLabel = this.add.text(barX + barW + 6, barY - 1, `REP ${state.reputation}`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      color: '#d4c5a0',
    });
    this.statusBar.add(repLabel);
  }

  // ================================================================
  // BOTTOM HALF: The Desk Workspace (y: 280-560)
  // ================================================================

  private drawBottomHalf(visitor: Visitor): void {
    this.bottomHalfContainer.removeAll(true);
    const gfx = this.add.graphics();
    this.bottomHalfContainer.add(gfx);

    // Main desk workspace background
    gfx.fillStyle(0x16140f, 1);
    gfx.fillRect(0, 280, 800, 280);

    // Warm-gold divider line separating top and bottom
    gfx.lineStyle(2, 0x8a7a50, 0.6);
    gfx.lineBetween(0, 280, 800, 280);

    // Panel dividers with subtle depth
    gfx.lineStyle(1, 0x2a261e, 1);
    gfx.lineBetween(200, 285, 200, 555);
    gfx.lineBetween(540, 285, 540, 555);

    // Panel backgrounds in slightly different shades
    // Headshot panel
    gfx.fillStyle(0x171510, 1);
    gfx.fillRect(1, 281, 199, 274);
    // Resume panel
    gfx.fillStyle(0x18160e, 1);
    gfx.fillRect(201, 281, 338, 274);
    // Book/Reel panel
    gfx.fillStyle(0x161410, 1);
    gfx.fillRect(541, 281, 259, 274);

    // Subtle inner borders for each panel
    gfx.lineStyle(1, 0x1e1c16, 0.5);
    gfx.strokeRect(4, 284, 193, 268);
    gfx.strokeRect(204, 284, 332, 268);
    gfx.strokeRect(544, 284, 252, 268);

    // Paper texture on resume panel (faint horizontal lines every 12px)
    gfx.lineStyle(1, 0x1e1c14, 0.15);
    for (let py = 296; py < 552; py += 12) {
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
    const hy = 290;

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
    const skinBase = visitor.gender === 'male' ? 0x8a6a4a : 0x9a7a5a;
    const hairColor = visitor.gender === 'male' ? 0x3a2a1a : 0x4a3020;

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

      // Face — oval with jawline
      gfx.fillStyle(skinBase, 1);
      gfx.fillEllipse(cx, photoY + 48, 48, 56);
      // Jawline shadow
      gfx.fillStyle(0x000000, 0.08);
      gfx.fillEllipse(cx, photoY + 58, 44, 36);

      // Ears
      gfx.fillStyle(skinBase, 0.8);
      gfx.fillEllipse(cx - 24, photoY + 46, 6, 10);
      gfx.fillEllipse(cx + 24, photoY + 46, 6, 10);

      // Hair
      gfx.fillStyle(hairColor, 1);
      gfx.fillEllipse(cx, photoY + 28, 52, 30);
      if (visitor.gender !== 'male') {
        gfx.fillRect(cx - 26, photoY + 26, 6, 40);
        gfx.fillRect(cx + 20, photoY + 26, 6, 40);
      }

      // Eyes — whites + iris + pupil
      gfx.fillStyle(0xffffff, 0.85);
      gfx.fillEllipse(cx - 9, photoY + 44, 10, 6);
      gfx.fillEllipse(cx + 9, photoY + 44, 10, 6);
      gfx.fillStyle(0x4a6a5a, 1);
      gfx.fillCircle(cx - 9, photoY + 44, 2.5);
      gfx.fillCircle(cx + 9, photoY + 44, 2.5);
      gfx.fillStyle(0x1a1a1a, 1);
      gfx.fillCircle(cx - 9, photoY + 44, 1.2);
      gfx.fillCircle(cx + 9, photoY + 44, 1.2);

      // Eyebrows
      gfx.fillStyle(hairColor, 0.7);
      gfx.fillRect(cx - 14, photoY + 38, 10, 2);
      gfx.fillRect(cx + 4, photoY + 38, 10, 2);

      // Nose
      gfx.fillStyle(0x000000, 0.1);
      gfx.fillTriangle(cx, photoY + 48, cx - 4, photoY + 57, cx + 4, photoY + 57);
      gfx.fillStyle(skinBase, 0.8);
      gfx.fillCircle(cx - 3, photoY + 56, 2);
      gfx.fillCircle(cx + 3, photoY + 56, 2);

      // Mouth
      gfx.fillStyle(0x8a4a3a, 0.6);
      gfx.fillEllipse(cx, photoY + 63, 12, 4);
      gfx.fillStyle(skinBase, 0.5);
      gfx.fillEllipse(cx, photoY + 61, 10, 2);

      // Studio light catch — subtle highlight on cheek
      gfx.fillStyle(0xffffff, 0.06);
      gfx.fillEllipse(cx - 12, photoY + 42, 12, 20);

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

    // Photo type label
    const typeLabels: Record<string, string> = {
      color_8x10: 'COLOR 8x10',
      atlanta_comp: 'ATLANTA COMP',
      bw_8x10: 'B&W 8x10',
    };
    const typeText = this.add.text(hx, photoY + photoH + 22, typeLabels[visitor.headshot.type] ?? '', {
      fontFamily: 'Courier New, monospace',
      fontSize: '12px',
      color: '#6a6050',
    });
    this.bottomHalfContainer.add(typeText);

    // Bribe envelope
    if (visitor.bribeOffer) {
      const envY = photoY + photoH + 38;

      // Manila envelope - slightly angled
      const envGfx = this.add.graphics();
      this.bottomHalfContainer.add(envGfx);

      // Shadow underneath
      envGfx.fillStyle(0x000000, 0.2);
      envGfx.fillRect(hx + 3, envY + 3, 100, 36);

      // Envelope body
      envGfx.fillStyle(0xc4a060, 1);
      envGfx.fillRect(hx, envY, 100, 36);
      envGfx.lineStyle(1, 0xa88840, 1);
      envGfx.strokeRect(hx, envY, 100, 36);

      // Flap (triangle on top)
      envGfx.fillStyle(0xb89050, 1);
      envGfx.beginPath();
      envGfx.moveTo(hx, envY);
      envGfx.lineTo(hx + 50, envY + 12);
      envGfx.lineTo(hx + 100, envY);
      envGfx.closePath();
      envGfx.fillPath();

      // Dollar sign
      const dollarText = this.add.text(hx + 8, envY + 10, `$${visitor.bribeOffer.amount}`, {
        fontFamily: 'Courier New, monospace',
        fontSize: '16px',
        color: '#4a3a18',
        fontStyle: 'bold',
      });
      this.bottomHalfContainer.add(dollarText);

      // ACCEPT button (green background)
      const acceptBg = this.add.graphics();
      this.bottomHalfContainer.add(acceptBg);
      acceptBg.fillStyle(0x2a4a2e, 1);
      acceptBg.fillRoundedRect(hx, envY + 40, 48, 22, 3);
      acceptBg.lineStyle(1, 0x4a7a4f, 1);
      acceptBg.strokeRoundedRect(hx, envY + 40, 48, 22, 3);

      const acceptBtn = this.add.text(hx + 5, envY + 43, 'ACCEPT', {
        fontFamily: 'Courier New, monospace',
        fontSize: '11px',
        color: '#6aba6f',
        fontStyle: 'bold',
      }).setInteractive({ useHandCursor: true });
      acceptBtn.on('pointerdown', () => this.handleBribe(visitor, true));
      this.bottomHalfContainer.add(acceptBtn);

      // REFUSE button (red background)
      const refuseBg = this.add.graphics();
      this.bottomHalfContainer.add(refuseBg);
      refuseBg.fillStyle(0x4a2a2a, 1);
      refuseBg.fillRoundedRect(hx + 54, envY + 40, 48, 22, 3);
      refuseBg.lineStyle(1, 0xc4553a, 1);
      refuseBg.strokeRoundedRect(hx + 54, envY + 40, 48, 22, 3);

      const refuseBtn = this.add.text(hx + 59, envY + 43, 'REFUSE', {
        fontFamily: 'Courier New, monospace',
        fontSize: '11px',
        color: '#e06050',
        fontStyle: 'bold',
      }).setInteractive({ useHandCursor: true });
      refuseBtn.on('pointerdown', () => this.handleBribe(visitor, false));
      this.bottomHalfContainer.add(refuseBtn);
    }
  }

  // ---- Resume Panel ----
  private drawResume(visitor: Visitor): void {
    const rx = 214;
    let ry = 290;

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

    // SAG status
    const sagColors: Record<string, string> = {
      current: '#4a7a4f',
      expired: '#c4553a',
      none: '#888070',
      claims_yes: '#e8c36a',
    };
    const sagText = this.add.text(rx, ry, `SAG: ${visitor.resume.sagStatus.toUpperCase()}`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: sagColors[visitor.resume.sagStatus] ?? '#888070',
      fontStyle: 'bold',
    });
    this.bottomHalfContainer.add(sagText);
    ry += 24;

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
        const creditText = this.add.text(rx + 8, ry, `- ${credit}`, {
          fontFamily: 'Courier New, monospace',
          fontSize: '14px',
          color: '#d4c5a0',
          wordWrap: { width: 300 },
        });
        this.bottomHalfContainer.add(creditText);
        ry += 15;
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
    let py = 290;

    const headerText = this.add.text(px, py, 'STUNT LISTING BOOK', {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      color: '#6a6050',
      letterSpacing: 2,
    });
    this.bottomHalfContainer.add(headerText);
    py += 20;

    // Look Up button
    const lastName = visitor.name.split(' ').slice(-1)[0] || visitor.name;

    const lookupBg = this.add.graphics();
    this.bottomHalfContainer.add(lookupBg);
    lookupBg.fillStyle(0x2a2618, 1);
    lookupBg.fillRoundedRect(px, py, 220, 34, 3);
    lookupBg.lineStyle(1, 0x5a4a2a, 1);
    lookupBg.strokeRoundedRect(px, py, 220, 34, 3);

    const lookupBtn = this.add.text(px + 8, py + 7, `LOOK UP: ${lastName}`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      color: '#e8c36a',
      fontStyle: 'bold',
    }).setInteractive({ useHandCursor: true });
    this.bottomHalfContainer.add(lookupBtn);
    py += 40;

    // Book result area
    this.bookResultText = this.add.text(px, py, '', {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      color: '#d4c5a0',
      wordWrap: { width: 230 },
      lineSpacing: 4,
    });
    this.bottomHalfContainer.add(this.bookResultText);

    lookupBtn.on('pointerdown', () => {
      this.idleTimer = 0;
      this.lookUpBook(visitor);
    });

    // Reel section
    const reelY = 420;
    const reelGfx = this.add.graphics();
    this.bottomHalfContainer.add(reelGfx);

    const reelHeader = this.add.text(px, reelY, 'SKILL REEL', {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      color: '#6a6050',
      letterSpacing: 2,
    });
    this.bottomHalfContainer.add(reelHeader);

    // TV / monitor rectangle - with bezel
    reelGfx.fillStyle(0x1a1a22, 1);
    reelGfx.fillRect(px - 2, reelY + 16, 234, 84);
    reelGfx.fillStyle(0x0a0a12, 1);
    reelGfx.fillRect(px + 4, reelY + 22, 222, 72);
    reelGfx.lineStyle(1, 0x2a2a36, 1);
    reelGfx.strokeRect(px - 2, reelY + 16, 234, 84);
    // tiny power LED
    reelGfx.fillStyle(visitor.skillReel ? 0x4a7a4f : 0x3a3a44, 1);
    reelGfx.fillCircle(px + 225, reelY + 26, 2);

    // Scanlines on TV
    reelGfx.lineStyle(1, 0x000000, 0.06);
    for (let sy = reelY + 24; sy < reelY + 92; sy += 3) {
      reelGfx.lineBetween(px + 5, sy, px + 225, sy);
    }

    this.reelDisplayText = this.add.text(px + 14, reelY + 30, visitor.skillReel ? 'TAPE READY' : 'NO TAPE', {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      color: visitor.skillReel ? '#4a7a4f' : '#6a6050',
    });
    this.bottomHalfContainer.add(this.reelDisplayText);

    if (visitor.skillReel) {
      const playBg = this.add.graphics();
      this.bottomHalfContainer.add(playBg);
      playBg.fillStyle(0x2a2618, 1);
      playBg.fillRoundedRect(px, reelY + 104, 140, 34, 3);
      playBg.lineStyle(1, 0x5a4a2a, 1);
      playBg.strokeRoundedRect(px, reelY + 104, 140, 34, 3);

      const playBtn = this.add.text(px + 8, reelY + 111, 'PLAY REEL', {
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

    const panelX = 10;
    const btnY = 432;
    const convoY = 480;
    const convoH = 74;

    const gfx = this.add.graphics();
    this.dialogueContainer.add(gfx);

    // Conversation history panel background
    gfx.fillStyle(0x0e0e14, 0.92);
    gfx.fillRoundedRect(panelX, convoY, 520, convoH, 4);
    gfx.lineStyle(1, 0x2a2a36, 0.8);
    gfx.strokeRoundedRect(panelX, convoY, 520, convoH, 4);

    // Render conversation history
    this.renderConversationHistory(panelX, convoY, convoH);

    // Dialogue option buttons — full width, row above conversation
    const options = [
      { key: 'tell_me_about_experience', label: 'Experience?' },
      { key: 'about_your_reel', label: 'Skills?' },
      { key: 'where_are_you_from', label: 'From where?' },
      { key: 'are_you_sag', label: 'SAG?' },
    ];

    const btnW = 150;
    const btnH = 34;
    const btnGap = 6;
    const startX = panelX;

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
        fontSize: '14px',
        color: '#e8c36a',
        fontStyle: 'bold',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      btn.on('pointerdown', () => {
        this.idleTimer = 0;
        const response = visitor.dialogueResponses[opt.key] ?? '...';
        this.conversationHistory.push({ question: opt.label, answer: response });
        this.drawDialogue(visitor);
      });

      this.dialogueContainer.add(btn);
    });

    // Action buttons — HIRE and GET LOST, big and prominent
    const actionY = convoY + convoH + 6;
    const actionBtnW = 180;
    const actionBtnH = 40;

    // HIRE button
    const hireBg = this.add.graphics();
    this.dialogueContainer.add(hireBg);
    hireBg.fillStyle(0x1a3a1e, 1);
    hireBg.fillRoundedRect(panelX, actionY, actionBtnW, actionBtnH, 6);
    hireBg.lineStyle(2, 0x4a7a4f, 1);
    hireBg.strokeRoundedRect(panelX, actionY, actionBtnW, actionBtnH, 6);

    const hireBtn = this.add.text(panelX + actionBtnW / 2, actionY + actionBtnH / 2, 'HIRE', {
      fontFamily: 'Courier New, monospace',
      fontSize: '20px',
      color: '#6aba6f',
      fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    hireBtn.on('pointerdown', () => {
      this.idleTimer = 0;
      this.showRolePicker(visitor);
    });
    this.dialogueContainer.add(hireBtn);

    // GET LOST button
    const rejectBg = this.add.graphics();
    this.dialogueContainer.add(rejectBg);
    rejectBg.fillStyle(0x3a1a1a, 1);
    rejectBg.fillRoundedRect(panelX + actionBtnW + 10, actionY, actionBtnW + 40, actionBtnH, 6);
    rejectBg.lineStyle(2, 0xc4553a, 1);
    rejectBg.strokeRoundedRect(panelX + actionBtnW + 10, actionY, actionBtnW + 40, actionBtnH, 6);

    const rejectBtn = this.add.text(panelX + actionBtnW + 10 + (actionBtnW + 40) / 2, actionY + actionBtnH / 2, 'GET LOST', {
      fontFamily: 'Courier New, monospace',
      fontSize: '20px',
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
    // Show last 3-4 conversation entries (or greeting if no history)
    const maxVisible = 4;
    const entries = this.conversationHistory.slice(-maxVisible);
    let ty = convoY + 4;
    const lineH = 14;
    const maxLineY = convoY + convoH - 4;

    if (entries.length === 0) {
      // Show the greeting as a single response
      // (greeting text is set via showVisitorResponse after drawDialogue)
      this.currentDialogueText = this.add.text(panelX + 8, ty, '', {
        fontFamily: 'Courier New, monospace',
        fontSize: '14px',
        color: '#d4c5a0',
        wordWrap: { width: 500 },
        lineSpacing: 2,
      });
      this.dialogueContainer.add(this.currentDialogueText);
      return;
    }

    // We have conversation entries; no need for standalone currentDialogueText
    this.currentDialogueText = null;

    entries.forEach(entry => {
      if (ty >= maxLineY) return;

      // Question (dim)
      const qText = this.add.text(panelX + 8, ty, `> ${entry.question}`, {
        fontFamily: 'Courier New, monospace',
        fontSize: '12px',
        color: '#6a6050',
        wordWrap: { width: 500 },
      });
      this.dialogueContainer.add(qText);
      ty += lineH + 2;

      if (ty >= maxLineY) return;

      // Answer (bright)
      const aText = this.add.text(panelX + 8, ty, entry.answer, {
        fontFamily: 'Courier New, monospace',
        fontSize: '14px',
        color: '#d4c5a0',
        wordWrap: { width: 500 },
        lineSpacing: 1,
      });
      this.dialogueContainer.add(aText);
      // Estimate height of wrapped text
      const estimatedLines = Math.ceil(entry.answer.length / 36);
      ty += estimatedLines * (lineH + 1) + 4;
    });
  }

  // ================================================================
  // VHS / ATMOSPHERE EFFECTS
  // ================================================================

  private drawVHSOverlay(): void {
    // Scanlines across the entire screen
    const scanGfx = this.add.graphics();
    this.vhsOverlayContainer.add(scanGfx);
    scanGfx.lineStyle(1, 0x000000, 0.04);
    for (let sy = 0; sy < 600; sy += 3) {
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
    vigGfx.fillRect(0, 540, 800, 60);
    // Left edge
    vigGfx.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.25, 0, 0.25, 0);
    vigGfx.fillRect(0, 0, 50, 600);
    // Right edge
    vigGfx.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0.25, 0, 0.25);
    vigGfx.fillRect(750, 0, 50, 600);

    // Film grain graphics (will be redrawn in update loop)
    this.grainGraphics = this.add.graphics();
    this.vhsOverlayContainer.add(this.grainGraphics);
  }

  private drawFilmGrain(): void {
    if (!this.grainGraphics) return;
    this.grainGraphics.clear();
    for (let i = 0; i < 25; i++) {
      const gx = randomInt(0, 800);
      const gy = randomInt(0, 600);
      this.grainGraphics.fillStyle(0x000000, 0.02 + Math.random() * 0.02);
      this.grainGraphics.fillRect(gx, gy, 1, 1);
    }
    // A few lighter grain dots too
    for (let i = 0; i < 10; i++) {
      const gx = randomInt(0, 800);
      const gy = randomInt(0, 600);
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
    this.currentVisitor = visitor;
    this.idleTimer = 0;
    this.bribeAccepted = false;
    this.conversationHistory = [];
    if (this.thoughtBubble) {
      this.thoughtBubble.destroy();
      this.thoughtBubble = null;
    }

    // Advance time
    this.gsm.advanceTime(randomInt(15, 35));

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

  private lookUpBook(visitor: Visitor): void {
    if (!this.bookResultText) return;

    const listing = this.bookSystem.lookupPerformer(visitor.name, this.bookListings);

    if (listing) {
      const lines = [
        `FOUND: ${listing.name}`,
        `City: ${listing.city}`,
        `Size: ${listing.height}, ${listing.weight} lbs`,
        `Skills: ${listing.skills.map(s => s.replace(/_/g, ' ')).join(', ') || 'none'}`,
        `Coord Credits: ${listing.coordinatorCredits.join(', ') || 'none'}`,
        listing.hasPhoto ? 'Photo: YES' : 'Photo: NO',
      ];
      this.bookResultText.setText(lines.join('\n'));
      this.bookResultText.setColor('#d4c5a0');
    } else {
      this.bookResultText.setText('NOT FOUND\n\nNo listing for this name.');
      this.bookResultText.setColor('#c4553a');
    }
  }

  private playReel(visitor: Visitor): void {
    if (!this.reelDisplayText || !visitor.skillReel) return;

    this.reelDisplayText.setText('>> PLAYING...');
    this.reelDisplayText.setColor('#e8c36a');

    this.time.delayedCall(800, () => {
      if (!this.reelDisplayText || !visitor.skillReel) return;
      const reel = visitor.skillReel;
      const state = this.gsm.getCurrentState();

      const dupCheck = this.reelSystem.checkForDuplicate(reel, state.seenReels);

      const animation = REEL_ANIMATIONS.find(a => a.id === reel.animationId);
      const animDesc = animation ? animation.description : reel.animationId.replace(/_/g, ' ');
      const animType = animation ? animation.stuntType : 'unknown';

      const bodyMismatch = this.reelSystem.checkBodyTypeMismatch(reel, visitor);

      const lines = [
        `TITLE: ${reel.titleCardName}`,
        `Stunt: ${animType}`,
        animDesc,
        `Build: ${reel.bodyType.build} ${reel.bodyType.height}" / ${reel.bodyType.weight}lb`,
      ];

      if (dupCheck.isDuplicate) {
        lines.push('');
        lines.push(`** DUPLICATE REEL **`);
        lines.push(`Same footage shown by: ${dupCheck.originalOwner}`);
        this.reelDisplayText!.setColor('#c4553a');

        this.showDuplicateReelCallout(visitor, dupCheck.originalOwner!);
      } else if (bodyMismatch) {
        lines.push('');
        lines.push('Body type mismatch with reel.');
        this.reelDisplayText!.setColor('#e8c36a');
      } else {
        this.reelDisplayText!.setColor('#d4c5a0');
      }

      this.reelDisplayText!.setText(lines.join('\n'));

      this.reelSystem.recordReel(reel, visitor.name, state.seenReels);
    });
  }

  private showDuplicateReelCallout(visitor: Visitor, originalOwner: string): void {
    const calloutBg = this.add.graphics();
    this.bottomHalfContainer.add(calloutBg);
    calloutBg.fillStyle(0x3a1a1a, 1);
    calloutBg.fillRoundedRect(540, 540, 200, 22, 3);
    calloutBg.lineStyle(1, 0xc4553a, 1);
    calloutBg.strokeRoundedRect(540, 540, 200, 22, 3);

    const calloutBtn = this.add.text(548, 543, 'CALL OUT DUPLICATE', {
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
        repChange: repGain,
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
    gfx.fillRoundedRect(150, 120, 500, 360, 6);
    gfx.lineStyle(2, 0x8a7a50, 0.8);
    gfx.strokeRoundedRect(150, 120, 500, 360, 6);

    const title = this.add.text(400, 140, 'ASSIGN TO ROLE:', {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: '#d4c5a0',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.overlayContainer.add(title);

    const unfilledRoles = this.roles.filter(r => r.filledBy === null);

    if (unfilledRoles.length === 0) {
      const noRoles = this.add.text(400, 280, 'No open roles.', {
        fontFamily: 'Courier New, monospace',
        fontSize: '16px',
        color: '#6a6050',
      }).setOrigin(0.5);
      this.overlayContainer.add(noRoles);
    } else {
      unfilledRoles.forEach((role, i) => {
        const ry = 170 + i * 50;
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
        roleBg.fillRoundedRect(175, ry - 4, 450, 44, 3);
        roleBg.lineStyle(1, 0x2a2a36, 0.6);
        roleBg.strokeRoundedRect(175, ry - 4, 450, 44, 3);

        const roleBtn = this.add.text(185, ry,
          `${role.title}  [${role.riskLevel.toUpperCase()}]${genderReq}`, {
          fontFamily: 'Courier New, monospace',
          fontSize: '15px',
          color: riskColors[role.riskLevel] ?? '#d4c5a0',
          fontStyle: 'bold',
        }).setInteractive({ useHandCursor: true });

        const reqText = this.add.text(200, ry + 22,
          `Needs: ${skillsReq} | ${heightReq} ${weightReq}${role.sagRequired ? ' | SAG REQ' : ''}`, {
          fontFamily: 'Courier New, monospace',
          fontSize: '10px',
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
    cancelBg.fillRoundedRect(350, 445, 100, 26, 4);
    cancelBg.lineStyle(1, 0x4a4a56, 1);
    cancelBg.strokeRoundedRect(350, 445, 100, 26, 4);

    const cancelBtn = this.add.text(400, 452, 'CANCEL', {
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
    } else if (role.riskLevel !== 'nd') {
      wasInjured = false;
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

    const result: HireResult = {
      visitorId: visitor.id,
      visitorName: visitor.name,
      roleId: role.id,
      roleTitle: role.title,
      outcome,
      repChange,
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
    } else {
      return 'correct_slight_mismatch';
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

    const outcome: HireOutcome = isFaker ? 'passed_faker' : 'passed_legit';
    const state = this.gsm.getCurrentState();
    const { repChange } = this.reputationSystem.applyHireResult(outcome, state);

    if (!state.rejectedVisitors.includes(visitor.id)) {
      state.rejectedVisitors.push(visitor.id);
    }

    this.hireResults.push({
      visitorId: visitor.id,
      visitorName: visitor.name,
      roleId: '',
      roleTitle: isFaker ? '(caught faker)' : '(rejected)',
      outcome,
      repChange,
      wasInjured: false,
      injury: null,
    });

    this.drawStatusBar();
    this.showVisitorResponse(`[${visitor.name} leaves.]`);
    this.time.delayedCall(400, () => this.nextVisitor());
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
    if (this.currentVisitorIndex >= this.visitors.length || allRolesFilled) {
      this.endNight();
      return;
    }

    this.presentVisitor(this.visitors[this.currentVisitorIndex]);
  }

  private performNdUpgrade(): void {
    const ndRole = this.ndUpgradeSystem.findNDRole(this.roles);

    if (!ndRole) {
      if (this.currentVisitorIndex >= this.visitors.length) {
        this.endNight();
      } else {
        this.presentVisitor(this.visitors[this.currentVisitorIndex]);
      }
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
    gfx.fillRoundedRect(100, 180, 600, 200, 6);
    gfx.lineStyle(2, 0xc4553a, 1);
    gfx.strokeRoundedRect(100, 180, 600, 200, 6);

    const title = this.add.text(400, 210, 'STUNT UPGRADE', {
      fontFamily: 'Courier New, monospace',
      fontSize: '22px',
      color: '#c4553a',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.overlayContainer.add(title);

    const upgradeText = this.ndUpgradeSystem.assessUpgradeRisk(upgradedRole);

    const desc = this.add.text(400, 270, upgradeText, {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      color: '#d4c5a0',
      wordWrap: { width: 500 },
      align: 'center',
    }).setOrigin(0.5);
    this.overlayContainer.add(desc);

    const note = this.add.text(400, 320, 'The AD just walked over and told you. Great.', {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      color: '#6a6050',
    }).setOrigin(0.5);
    this.overlayContainer.add(note);

    const okBg = this.add.graphics();
    this.overlayContainer.add(okBg);
    okBg.fillStyle(0x2a2618, 1);
    okBg.fillRoundedRect(370, 348, 60, 26, 4);
    okBg.lineStyle(1, 0x5a4a2a, 1);
    okBg.strokeRoundedRect(370, 348, 60, 26, 4);

    const okBtn = this.add.text(400, 355, 'OK', {
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
        repChange,
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
      ];
      kidExpense = randomPick(kidExpenses);
    }

    const totalRepChange = this.hireResults.reduce((sum, r) => sum + r.repChange, 0);
    const injuries = this.hireResults.filter(r => r.injury).map(r => r.injury!);

    const state = this.gsm.getCurrentState();

    const nightResult: NightResult = {
      night: this.night,
      hires: this.hireResults,
      rejections: this.rejections,
      injuries,
      repChange: totalRepChange,
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
