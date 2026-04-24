export const CONFIG = {
    PHYSICS: {
        gravity: -20,
        fixedTimeStep: 1/60,
        maxSubSteps: 3
    },
    
    BLOCK: {
        minSize: { x: 0.8, y: 0.3, z: 0.8 },
        maxSize: { x: 2.5, y: 0.5, z: 2.5 },
        density: 2.5,
        friction: 0.5,
        restitution: 0.1,
        angularDamping: 0.5
    },
    
    GAME: {
        baseSpeed: 1.0,
        speedIncreasePerScore: 0.02,
        maxSpeed: 3.0,
        spawnHeight: 5,
        collapseAngleThreshold: Math.PI / 4,
        collapseVelocityThreshold: 5,
        maxBlocks: 100
    },
    
    SKINS: {
        simple: {
            colors: [
                0x4facfe, 0x00f2fe, 0x667eea, 0x764ba2,
                0xf093fb, 0xf5576c, 0x4ecdc4, 0x45b7d1
            ],
            emissive: 0x000000,
            metalness: 0.3,
            roughness: 0.5
        },
        cartoon: {
            colors: [
                0xff6b6b, 0x4ecdc4, 0x45b7d1, 0x96ceb4,
                0xffeaa7, 0xdfe6e9, 0xfd79a8, 0xa29bfe
            ],
            emissive: 0x111122,
            metalness: 0.1,
            roughness: 0.8
        },
        vintage: {
            colors: [
                0xf6d365, 0xfda085, 0xfa709a, 0xff0844,
                0xb2fe55, 0x00e5ff, 0xffd93d, 0x6c5ce7
            ],
            emissive: 0x221100,
            metalness: 0.5,
            roughness: 0.3
        }
    },
    
    STORAGE: {
        highScore: 'funJenga_highScore',
        currentSkin: 'funJenga_currentSkin',
        items: 'funJenga_items'
    },
    
    ITEMS: {
        initialFixCount: 0,
        initialSlowCount: 0,
        slowDuration: 10000,
        fixForce: 100
    }
};
