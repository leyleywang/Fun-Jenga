import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { CONFIG } from './config.js';

class Game {
    constructor() {
        this.state = 'menu';
        this.score = 0;
        this.height = 0;
        this.highScore = this.loadHighScore();
        this.currentSkin = this.loadCurrentSkin();
        this.speedMultiplier = CONFIG.GAME.baseSpeed;
        this.currentAngle = 0;
        
        this.items = this.loadItems();
        this.isSlowMode = false;
        this.slowEndTime = 0;
        
        this.blocks = [];
        this.currentBlock = null;
        this.currentBlockMesh = null;
        this.currentBlockBody = null;
        
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.world = null;
        this.ground = null;
        this.groundMesh = null;
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.animationId = null;
        this.lastTime = 0;
        
        this.init();
        this.bindEvents();
        this.updateUI();
    }
    
    init() {
        this.createScene();
        this.createPhysicsWorld();
        this.createGround();
        this.createLights();
        this.createCameraControls();
        this.animate();
    }
    
    createScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);
        this.scene.fog = new THREE.Fog(0x1a1a2e, 20, 50);
        
        this.renderer = new THREE.WebGLRenderer({
            canvas: document.getElementById('gameCanvas'),
            antialias: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    
    createPhysicsWorld() {
        this.world = new CANNON.World();
        this.world.gravity.set(0, CONFIG.PHYSICS.gravity, 0);
        this.world.broadphase = new CANNON.NaiveBroadphase();
        this.world.solver.iterations = 10;
        this.world.allowSleep = true;
    }
    
    createGround() {
        const groundMaterial = new CANNON.Material('ground');
        
        this.ground = new CANNON.Body({
            mass: 0,
            shape: new CANNON.Plane(),
            material: groundMaterial
        });
        this.ground.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        this.world.addBody(this.ground);
        
        const groundGeometry = new THREE.PlaneGeometry(30, 30);
        const groundMaterialThree = new THREE.MeshStandardMaterial({
            color: 0x2d3436,
            roughness: 0.8,
            metalness: 0.2
        });
        this.groundMesh = new THREE.Mesh(groundGeometry, groundMaterialThree);
        this.groundMesh.rotation.x = -Math.PI / 2;
        this.groundMesh.receiveShadow = true;
        this.scene.add(this.groundMesh);
        
        const gridHelper = new THREE.GridHelper(30, 30, 0x444444, 0x333333);
        gridHelper.position.y = 0.01;
        this.scene.add(gridHelper);
    }
    
    createLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(10, 20, 10);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 50;
        directionalLight.shadow.camera.left = -15;
        directionalLight.shadow.camera.right = 15;
        directionalLight.shadow.camera.top = 15;
        directionalLight.shadow.camera.bottom = -15;
        this.scene.add(directionalLight);
        
        const fillLight = new THREE.DirectionalLight(0x8888ff, 0.5);
        fillLight.position.set(-10, 10, -10);
        this.scene.add(fillLight);
    }
    
    createCameraControls() {
        this.camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            0.1,
            100
        );
        this.camera.position.set(0, 8, 15);
        this.camera.lookAt(0, 3, 0);
    }
    
    updateCamera() {
        const targetHeight = Math.max(3, this.height + 3);
        const targetY = targetHeight + 5;
        const targetZ = targetHeight + 12;
        
        this.camera.position.y += (targetY - this.camera.position.y) * 0.02;
        this.camera.position.z += (targetZ - this.camera.position.z) * 0.02;
        
        const lookTarget = new THREE.Vector3(0, targetHeight, 0);
        this.camera.lookAt(lookTarget);
    }
    
    generateBlockSize() {
        const min = CONFIG.BLOCK.minSize;
        const max = CONFIG.BLOCK.maxSize;
        
        return {
            x: min.x + Math.random() * (max.x - min.x),
            y: min.y + Math.random() * (max.y - min.y),
            z: min.z + Math.random() * (max.z - min.z)
        };
    }
    
    getRandomColor() {
        const skin = CONFIG.SKINS[this.currentSkin];
        const colors = skin.colors;
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    createBlockMaterial(color) {
        const skin = CONFIG.SKINS[this.currentSkin];
        
        return new THREE.MeshStandardMaterial({
            color: color,
            emissive: skin.emissive,
            metalness: skin.metalness,
            roughness: skin.roughness
        });
    }
    
    spawnBlock() {
        if (this.state !== 'playing') return;
        
        const size = this.generateBlockSize();
        const color = this.getRandomColor();
        const spawnY = CONFIG.GAME.spawnHeight + this.height;
        
        const shape = new CANNON.Box(
            new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2)
        );
        
        const blockMaterial = new CANNON.Material('block');
        const groundContactMaterial = new CANNON.ContactMaterial(
            this.ground.material,
            blockMaterial,
            {
                friction: CONFIG.BLOCK.friction,
                restitution: CONFIG.BLOCK.restitution
            }
        );
        this.world.addContactMaterial(groundContactMaterial);
        
        const blockContactMaterial = new CANNON.ContactMaterial(
            blockMaterial,
            blockMaterial,
            {
                friction: CONFIG.BLOCK.friction * 1.2,
                restitution: CONFIG.BLOCK.restitution
            }
        );
        this.world.addContactMaterial(blockContactMaterial);
        
        const body = new CANNON.Body({
            mass: 0,
            shape: shape,
            material: blockMaterial,
            type: CANNON.Body.KINEMATIC
        });
        
        body.position.set(0, spawnY, 0);
        body.isFixed = false;
        body.isFalling = false;
        body.isControlled = true;
        body.blockMass = 1;
        body.blockShape = shape;
        body.blockMaterial = blockMaterial;
        
        const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
        const material = this.createBlockMaterial(color);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        const edgesGeometry = new THREE.EdgesGeometry(geometry);
        const edgesMaterial = new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.3
        });
        const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
        mesh.add(edges);
        
        mesh.position.copy(body.position);
        mesh.quaternion.copy(body.quaternion);
        
        this.scene.add(mesh);
        
        this.currentBlock = mesh;
        this.currentBlockBody = body;
        this.currentAngle = 0;
        
        this.updateAngleIndicator();
    }
    
    dropCurrentBlock() {
        if (!this.currentBlock || !this.currentBlockBody) return;
        if (this.currentBlockBody.isFalling) return;
        
        const oldBody = this.currentBlockBody;
        const position = oldBody.position.clone();
        const quaternion = oldBody.quaternion.clone();
        
        this.world.removeBody(oldBody);
        
        const newBody = new CANNON.Body({
            mass: oldBody.blockMass || 1,
            shape: oldBody.blockShape,
            material: oldBody.blockMaterial,
            linearDamping: 0.1,
            angularDamping: CONFIG.BLOCK.angularDamping,
            type: CANNON.Body.DYNAMIC
        });
        
        newBody.position.copy(position);
        newBody.quaternion.copy(quaternion);
        newBody.isFalling = true;
        newBody.isControlled = false;
        newBody.isFixed = false;
        
        this.world.addBody(newBody);
        
        const blockIndex = this.blocks.findIndex(b => b.body === oldBody);
        if (blockIndex >= 0) {
            this.blocks[blockIndex].body = newBody;
        }
        
        this.blocks.push({
            body: newBody,
            mesh: this.currentBlock
        });
        
        setTimeout(() => {
            if (this.state === 'playing') {
                this.checkLandingAndSpawn();
            }
        }, 1500);
        
        this.currentBlock = null;
        this.currentBlockBody = null;
    }
    
    checkLandingAndSpawn() {
        if (this.state !== 'playing') return;
        
        const lastBlock = this.blocks[this.blocks.length - 1];
        if (!lastBlock) return;
        
        const body = lastBlock.body;
        
        const velocityThreshold = 0.3;
        if (Math.abs(body.velocity.y) > velocityThreshold) {
            setTimeout(() => this.checkLandingAndSpawn(), 300);
            return;
        }
        
        if (this.checkCollapse()) {
            this.gameOver();
            return;
        }
        
        this.updateScoreAndHeight();
        
        setTimeout(() => {
            if (this.state === 'playing') {
                this.spawnBlock();
            }
        }, 500);
    }
    
    checkCollapse() {
        const thresholdAngle = CONFIG.GAME.collapseAngleThreshold;
        
        for (let i = Math.max(0, this.blocks.length - 5); i < this.blocks.length; i++) {
            const block = this.blocks[i];
            const body = block.body;
            
            const euler = new THREE.Euler().setFromQuaternion(
                new THREE.Quaternion(
                    body.quaternion.x,
                    body.quaternion.y,
                    body.quaternion.z,
                    body.quaternion.w
                )
            );
            
            if (Math.abs(euler.x) > thresholdAngle || 
                Math.abs(euler.z) > thresholdAngle) {
                return true;
            }
            
            if (body.position.y < -2) {
                return true;
            }
        }
        
        return false;
    }
    
    updateScoreAndHeight() {
        let maxHeight = 0;
        
        for (const block of this.blocks) {
            const body = block.body;
            const size = block.mesh.geometry.parameters;
            const blockTop = body.position.y + size.height / 2;
            if (blockTop > maxHeight) {
                maxHeight = blockTop;
            }
        }
        
        const newHeight = Math.max(0, Math.floor(maxHeight * 10) / 10);
        
        if (newHeight > this.height) {
            const heightDiff = newHeight - this.height;
            this.score += Math.floor(heightDiff * 10);
            this.height = newHeight;
            
            this.updateSpeed();
        }
        
        this.updateUI();
    }
    
    updateSpeed() {
        this.speedMultiplier = Math.min(
            CONFIG.GAME.maxSpeed,
            CONFIG.GAME.baseSpeed + this.score * CONFIG.GAME.speedIncreasePerScore
        );
    }
    
    updateAngleIndicator() {
        const angleDeg = Math.round((this.currentAngle * 180 / Math.PI) % 360);
        document.getElementById('angleValue').textContent = `${angleDeg}°`;
    }
    
    bindEvents() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
        
        document.addEventListener('mousemove', (e) => {
            if (this.state !== 'playing' || !this.currentBlock || !this.currentBlockBody) return;
            if (this.currentBlockBody.isFalling) return;
            
            this.handleMouseMove(e);
        });
        
        document.addEventListener('click', (e) => {
            if (e.target.closest('.btn') || e.target.closest('.item-btn') || 
                e.target.closest('.skin-option') || e.target.closest('.toggle')) {
                return;
            }
            
            if (this.state !== 'playing' || !this.currentBlock) return;
            this.dropCurrentBlock();
        });
        
        document.addEventListener('touchmove', (e) => {
            if (this.state !== 'playing' || !this.currentBlock || !this.currentBlockBody) return;
            if (this.currentBlockBody.isFalling) return;
            
            e.preventDefault();
            const touch = e.touches[0];
            this.handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
        }, { passive: false });
        
        document.addEventListener('touchend', (e) => {
            if (e.target.closest('.btn') || e.target.closest('.item-btn') || 
                e.target.closest('.skin-option') || e.target.closest('.toggle')) {
                return;
            }
            
            if (this.state !== 'playing' || !this.currentBlock) return;
            this.dropCurrentBlock();
        });
        
        window.addEventListener('keydown', (e) => {
            if (this.state !== 'playing' || !this.currentBlock) return;
            if (this.currentBlockBody && this.currentBlockBody.isFalling) return;
            
            if (e.key === 'ArrowLeft') {
                this.currentAngle -= 0.15;
                this.updateBlockRotation();
            } else if (e.key === 'ArrowRight') {
                this.currentAngle += 0.15;
                this.updateBlockRotation();
            } else if (e.key === ' ') {
                e.preventDefault();
                this.dropCurrentBlock();
            }
        });
        
        this.bindUIEvents();
    }
    
    handleMouseMove(e) {
        if (!this.currentBlock || !this.currentBlockBody) return;
        if (this.currentBlockBody.isFalling) return;
        
        const rect = this.renderer.domElement.getBoundingClientRect();
        
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        const blockY = this.currentBlockBody.position.y;
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -blockY);
        
        const intersection = this.raycaster.ray.intersectPlane(plane);
        
        if (intersection) {
            const limit = 6;
            intersection.x = Math.max(-limit, Math.min(limit, intersection.x));
            intersection.z = Math.max(-limit, Math.min(limit, intersection.z));
            
            this.currentBlockBody.position.x = intersection.x;
            this.currentBlockBody.position.z = intersection.z;
            this.currentBlock.position.copy(this.currentBlockBody.position);
        }
    }
    
    updateBlockRotation() {
        if (!this.currentBlock || !this.currentBlockBody) return;
        
        const quaternion = new THREE.Quaternion();
        quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.currentAngle);
        
        this.currentBlockBody.quaternion.copy(quaternion);
        this.currentBlock.quaternion.copy(quaternion);
        
        this.updateAngleIndicator();
    }
    
    bindUIEvents() {
        document.getElementById('startBtn').addEventListener('click', () => {
            this.startGame();
        });
        
        document.getElementById('pauseBtn').addEventListener('click', () => {
            this.pauseGame();
        });
        
        document.getElementById('resumeBtn').addEventListener('click', () => {
            this.resumeGame();
        });
        
        document.getElementById('restartBtn').addEventListener('click', () => {
            this.restartGame();
        });
        
        document.getElementById('playAgainBtn').addEventListener('click', () => {
            this.restartGame();
        });
        
        document.querySelectorAll('.skin-option').forEach(option => {
            option.addEventListener('click', (e) => {
                this.selectSkin(e.target.dataset.skin);
            });
        });
        
        document.getElementById('fixBtn').addEventListener('click', () => {
            this.useFixItem();
        });
        
        document.getElementById('slowBtn').addEventListener('click', () => {
            this.useSlowItem();
        });
        
        document.getElementById('watchAdBtn').addEventListener('click', () => {
            this.watchAd();
        });
        
        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.showSettings();
        });
        
        document.getElementById('closeSettingsBtn').addEventListener('click', () => {
            this.hideSettings();
        });
        
        document.getElementById('soundToggle').addEventListener('click', (e) => {
            e.target.classList.toggle('active');
        });
        
        document.getElementById('particlesToggle').addEventListener('click', (e) => {
            e.target.classList.toggle('active');
        });
        
        document.getElementById('hapticToggle').addEventListener('click', (e) => {
            e.target.classList.toggle('active');
        });
    }
    
    selectSkin(skin) {
        this.currentSkin = skin;
        this.saveCurrentSkin();
        
        document.querySelectorAll('.skin-option').forEach(option => {
            option.classList.remove('selected');
            if (option.dataset.skin === skin) {
                option.classList.add('selected');
            }
        });
    }
    
    useFixItem() {
        if (this.items.fixCount <= 0 || this.blocks.length === 0) return;
        
        this.items.fixCount--;
        this.saveItems();
        
        const lastBlock = this.blocks[this.blocks.length - 1];
        if (lastBlock) {
            lastBlock.body.isFixed = true;
            lastBlock.body.linearDamping = 0.99;
            lastBlock.body.angularDamping = 0.99;
            lastBlock.body.velocity.set(0, 0, 0);
            lastBlock.body.angularVelocity.set(0, 0, 0);
            
            lastBlock.mesh.material.emissive = new THREE.Color(0x4ade80);
            lastBlock.mesh.material.emissiveIntensity = 0.5;
        }
        
        this.updateUI();
    }
    
    useSlowItem() {
        if (this.items.slowCount <= 0) return;
        
        this.items.slowCount--;
        this.isSlowMode = true;
        this.slowEndTime = Date.now() + CONFIG.ITEMS.slowDuration;
        this.saveItems();
        
        this.world.gravity.set(0, CONFIG.PHYSICS.gravity * 0.3, 0);
        
        document.getElementById('slowBtn').classList.add('active');
        
        setTimeout(() => {
            if (this.isSlowMode) {
                this.isSlowMode = false;
                this.world.gravity.set(0, CONFIG.PHYSICS.gravity, 0);
                document.getElementById('slowBtn').classList.remove('active');
            }
        }, CONFIG.ITEMS.slowDuration);
        
        this.updateUI();
    }
    
    watchAd() {
        const adScreen = document.getElementById('adScreen');
        const timerEl = document.getElementById('adTimer');
        
        adScreen.classList.remove('hidden');
        
        let timeLeft = 5;
        timerEl.textContent = timeLeft;
        
        const interval = setInterval(() => {
            timeLeft--;
            timerEl.textContent = timeLeft;
            
            if (timeLeft <= 0) {
                clearInterval(interval);
                adScreen.classList.add('hidden');
                
                const reward = Math.random() > 0.5 ? 'fix' : 'slow';
                if (reward === 'fix') {
                    this.items.fixCount++;
                } else {
                    this.items.slowCount++;
                }
                this.saveItems();
                this.updateUI();
            }
        }, 1000);
    }
    
    showSettings() {
        document.getElementById('settingsScreen').classList.remove('hidden');
        if (this.state === 'playing') {
            this.pauseGame();
        }
    }
    
    hideSettings() {
        document.getElementById('settingsScreen').classList.add('hidden');
    }
    
    startGame() {
        this.state = 'playing';
        this.score = 0;
        this.height = 0;
        this.speedMultiplier = CONFIG.GAME.baseSpeed;
        
        document.getElementById('startScreen').classList.add('hidden');
        document.getElementById('gameOverScreen').classList.add('hidden');
        document.getElementById('pauseScreen').classList.add('hidden');
        
        this.clearBlocks();
        this.spawnBlock();
        this.updateUI();
    }
    
    pauseGame() {
        if (this.state !== 'playing') return;
        this.state = 'paused';
        document.getElementById('pauseScreen').classList.remove('hidden');
    }
    
    resumeGame() {
        if (this.state !== 'paused') return;
        this.state = 'playing';
        document.getElementById('pauseScreen').classList.add('hidden');
    }
    
    restartGame() {
        this.clearBlocks();
        this.startGame();
    }
    
    gameOver() {
        this.state = 'gameOver';
        
        const isNewRecord = this.score > this.highScore;
        if (isNewRecord) {
            this.highScore = this.score;
            this.saveHighScore();
        }
        
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('finalHeight').textContent = this.height.toFixed(1);
        document.getElementById('gameOverHighScore').textContent = this.highScore;
        
        const newRecordBadge = document.getElementById('newRecordBadge');
        if (isNewRecord) {
            newRecordBadge.classList.remove('hidden');
        } else {
            newRecordBadge.classList.add('hidden');
        }
        
        document.getElementById('gameOverScreen').classList.remove('hidden');
        this.updateUI();
    }
    
    clearBlocks() {
        for (const block of this.blocks) {
            this.world.removeBody(block.body);
            this.scene.remove(block.mesh);
        }
        this.blocks = [];
        
        if (this.currentBlockBody) {
            this.world.removeBody(this.currentBlockBody);
            this.currentBlockBody = null;
        }
        
        if (this.currentBlock) {
            this.scene.remove(this.currentBlock);
            this.currentBlock = null;
        }
        
        this.isSlowMode = false;
        this.world.gravity.set(0, CONFIG.PHYSICS.gravity, 0);
        document.getElementById('slowBtn').classList.remove('active');
        
        this.camera.position.set(0, 8, 15);
        this.camera.lookAt(0, 3, 0);
    }
    
    updateUI() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('height').textContent = this.height.toFixed(1);
        document.getElementById('speed').textContent = this.speedMultiplier.toFixed(1);
        document.getElementById('highScore').textContent = this.highScore;
        document.getElementById('menuHighScore').textContent = this.highScore;
        
        document.getElementById('fixCount').textContent = this.items.fixCount;
        document.getElementById('slowCount').textContent = this.items.slowCount;
        
        const fixBtn = document.getElementById('fixBtn');
        const slowBtn = document.getElementById('slowBtn');
        
        if (this.items.fixCount <= 0) {
            fixBtn.classList.add('disabled');
        } else {
            fixBtn.classList.remove('disabled');
        }
        
        if (this.items.slowCount <= 0) {
            slowBtn.classList.add('disabled');
        } else {
            slowBtn.classList.remove('disabled');
        }
    }
    
    loadHighScore() {
        const saved = localStorage.getItem(CONFIG.STORAGE.highScore);
        return saved ? parseInt(saved) : 0;
    }
    
    saveHighScore() {
        localStorage.setItem(CONFIG.STORAGE.highScore, this.highScore.toString());
    }
    
    loadCurrentSkin() {
        const saved = localStorage.getItem(CONFIG.STORAGE.currentSkin);
        return saved || 'simple';
    }
    
    saveCurrentSkin() {
        localStorage.setItem(CONFIG.STORAGE.currentSkin, this.currentSkin);
    }
    
    loadItems() {
        const saved = localStorage.getItem(CONFIG.STORAGE.items);
        if (saved) {
            return JSON.parse(saved);
        }
        return {
            fixCount: CONFIG.ITEMS.initialFixCount,
            slowCount: CONFIG.ITEMS.initialSlowCount
        };
    }
    
    saveItems() {
        localStorage.setItem(CONFIG.STORAGE.items, JSON.stringify(this.items));
    }
    
    animate(currentTime = 0) {
        this.animationId = requestAnimationFrame((time) => this.animate(time));
        
        const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.05);
        this.lastTime = currentTime;
        
        if (this.state === 'playing') {
            this.world.step(CONFIG.PHYSICS.fixedTimeStep, deltaTime, CONFIG.PHYSICS.maxSubSteps);
            
            for (const block of this.blocks) {
                if (block.body.isControlled) continue;
                block.mesh.position.copy(block.body.position);
                block.mesh.quaternion.copy(block.body.quaternion);
            }
            
            if (this.currentBlock && this.currentBlockBody) {
                if (this.currentBlockBody.isFalling) {
                    this.currentBlock.position.copy(this.currentBlockBody.position);
                    this.currentBlock.quaternion.copy(this.currentBlockBody.quaternion);
                }
            }
            
            this.updateCamera();
        }
        
        this.renderer.render(this.scene, this.camera);
    }
    
    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        this.clearBlocks();
        
        if (this.renderer) {
            this.renderer.dispose();
        }
    }
}

const game = new Game();
