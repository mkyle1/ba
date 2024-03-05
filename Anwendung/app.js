window.addEventListener('DOMContentLoaded', () => {
    // Get the canvas element
    const canvas = document.getElementById('renderCanvas');

    // Generate the BABYLON 3D engine
    const engine = new BABYLON.Engine(canvas, true);

    // Create the scene
    const createScene = () => {
        // Create a basic BJS Scene object
        const scene = new BABYLON.Scene(engine);

        // Create a FreeCamera, and set its position to (x:0, y:5, z:-10)
        const camera = new BABYLON.FreeCamera('camera1', new BABYLON.Vector3(0, 5, -10), scene);

        // Target the camera to scene origin
        camera.setTarget(BABYLON.Vector3.Zero());

        // Attach the camera to the canvas
        camera.attachControl(canvas, false);

        // Create a basic light, aiming 0, 1, 0 - meaning, to the sky
        const light = new BABYLON.HemisphericLight('light1', new BABYLON.Vector3(0, 1, 0), scene);

        // Create a built-in "sphere" shape; its constructor takes 6 params: name, segment, diameter, scene, updatable, sideOrientation
        const sphere = BABYLON.MeshBuilder.CreateSphere('sphere1', {segments: 16, diameter: 2}, scene);

        // Move the sphere upward 1/2 of its height
        sphere.position.y = 1;

        // Create a built-in "ground" shape
        const ground = BABYLON.MeshBuilder.CreateGround('ground1', {width: 6, height: 6}, scene);

        return scene;
    };

    const scene = createScene();

    engine.runRenderLoop(() => {
        scene.render();
    });

    // Resize the engine on window resize
    window.addEventListener('resize', () => {
        engine.resize();
    });
});
