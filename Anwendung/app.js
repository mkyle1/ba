var canvas = document.getElementById("renderCanvas");

var startRenderLoop = function (engine, canvas) {
    engine.runRenderLoop(function () {
        if (sceneToRender && sceneToRender.activeCamera) {
            sceneToRender.render();
        }
    });
}

var engine = null;
var scene = null;
var sceneToRender = null;
var createDefaultEngine = function() { return new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true,  disableWebGL2Support: false}); };
/**
 * WebXR ar demo using hit-test, anchors, and plane detection.
 * 
 * Every press on the screen will add a figure in the requested position (if the ring is displayed). Those meshes will be kept in place by the AR system you are using.
 * 
 * Working (at the moment) on android devices and the latest chrome.
 * 
 * Created by Raanan Weber (@RaananW)
 */

var createScene = async function () {

    // This creates a basic Babylon Scene object (non-mesh)
    var scene = new BABYLON.Scene(engine);

    // This creates and positions a free camera (non-mesh)
    var camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 1, -5), scene);

    // This targets the camera to scene origin
    camera.setTarget(BABYLON.Vector3.Zero());

    // This attaches the camera to the canvas
    camera.attachControl(canvas, true);

    // This creates a light, aiming 0,1,0 - to the sky (non-mesh)
    var light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);

    // Default intensity is 1. Let's dim the light a small amount
    light.intensity = 0.7;

    var dirLight = new BABYLON.DirectionalLight('light', new BABYLON.Vector3(0, -1, -0.5), scene);
    dirLight.position = new BABYLON.Vector3(0, 5, -5);

    var shadowGenerator = new BABYLON.ShadowGenerator(1024, dirLight);
    shadowGenerator.useBlurExponentialShadowMap = true;
    shadowGenerator.blurKernel = 32;

    //const model = await BABYLON.SceneLoader.ImportMeshAsync("", "./scenes/", "dummy3.babylon", scene);
    const model = await BABYLON.SceneLoader.ImportMeshAsync("", "./scenes/", "cylinder.babylon", scene);

    var xr = await scene.createDefaultXRExperienceAsync({
        uiOptions: {
            sessionMode: "immersive-ar",
            referenceSpaceType: "local-floor"
        },
        inputOptions: {
            handedness: "right",
        },
        optionalFeatures: true
    });

   /*  xr.input.onControllerAddedObservable.add((controller) => {
        controller.onMotionControllerInitObservable.add((motionController) => {
            if (motionController.handness === "right") {
                motionController.onButtonStateChangedObservable.add((button) => {
                    const xr_ids = motionController.getComponentIds();
                    let triggerComponent = motionController.getComponent(xr_ids[0]);
                    triggerComponent.onButtonStateChangedObservable.add(() => {
                        if (triggerComponent.pressed) {
                            console.log('pressed');
                        } else {
                            console.log('released');
                        }
                    });
                    if (button.changes.pressed) {
                        if (triggerComponent.pressed) {
                            console.log('pressed');
                        } else {
                            console.log('released');
                        }
                    }
                });
            } else if (motionController.handness === "left") {
                motionController.onButtonStateChangedObservable.add(() => {
                    if (button.changes.pressed) {
                        if (button.pressed) {
                            console.log('pressed');
                        } else {
                            console.log('released');
                        }
                    }
                });
            }
        });
    }); */

    const fm = xr.baseExperience.featuresManager;

    const xrTest = fm.enableFeature(BABYLON.WebXRHitTest.Name, "latest");
    const xrPlanes = fm.enableFeature(BABYLON.WebXRPlaneDetector.Name, "latest");       // used to detect the floor 
    const anchors = fm.enableFeature(BABYLON.WebXRAnchorSystem.Name, 'latest');         // used to place objects in the real world

    const xrBackgroundRemover = fm.enableFeature(BABYLON.WebXRBackgroundRemover.Name);  // makes the background transparent

    let b = model.meshes[0];//BABYLON.CylinderBuilder.CreateCylinder('cylinder', { diameterBottom: 0.2, diameterTop: 0.4, height: 0.5 });
    b.rotationQuaternion = new BABYLON.Quaternion();
    // b.isVisible = false;
    shadowGenerator.addShadowCaster(b, true);

    const marker = BABYLON.MeshBuilder.CreateTorus('marker', { diameter: 0.15, thickness: 0.05 });
    marker.isVisible = false;
    marker.rotationQuaternion = new BABYLON.Quaternion();


    // ROBOT
    /* var skeleton = model.skeletons[0];
    skeleton.animationPropertiesOverride = new BABYLON.AnimationPropertiesOverride();
    skeleton.animationPropertiesOverride.enableBlending = true;
    skeleton.animationPropertiesOverride.blendingSpeed = 0.05;
    skeleton.animationPropertiesOverride.loopMode = 1;

    var idleRange = skeleton.getAnimationRange("YBot_Idle");
    var walkRange = skeleton.getAnimationRange("YBot_Walk");
    var runRange = skeleton.getAnimationRange("YBot_Run");
    var leftRange = skeleton.getAnimationRange("YBot_LeftStrafeWalk");
    var rightRange = skeleton.getAnimationRange("YBot_RightStrafeWalk");
    scene.beginAnimation(skeleton, idleRange.from, idleRange.to, true); */

    let hitTest;

    b.isVisible = false;

    

    xrTest.onHitTestResultObservable.add((results) => {
        if (results.length) {
            marker.isVisible = true;
            hitTest = results[0];
            hitTest.transformationMatrix.decompose(undefined, b.rotationQuaternion, b.position);
            hitTest.transformationMatrix.decompose(undefined, marker.rotationQuaternion, marker.position);
        } else {
            marker.isVisible = false;
            hitTest = undefined;
        }
    });
    const mat1 = new BABYLON.StandardMaterial('1', scene);
    mat1.diffuseColor = BABYLON.Color3.Red();
    const mat2 = new BABYLON.StandardMaterial('1', scene);
    mat2.diffuseColor = BABYLON.Color3.Blue();

    if (anchors) {
        console.log('anchors attached');
        anchors.onAnchorAddedObservable.add(anchor => {
            console.log('attaching', anchor);
            b.isVisible = true;
            anchor.attachedNode = b.clone("mensch");
            //anchor.attachedNode.skeleton = skeleton.clone('skelet');
            shadowGenerator.addShadowCaster(anchor.attachedNode, true);
            //scene.beginAnimation(anchor.attachedNode.skeleton, idleRange.from, idleRange.to, true);
            b.isVisible = false;
        })

        anchors.onAnchorRemovedObservable.add(anchor => {
            console.log('disposing', anchor);
            if (anchor) {
                anchor.attachedNode.isVisible = false;
                anchor.attachedNode.dispose();
            }
        });
    }

    scene.onPointerDown = (evt, pickInfo) => {
        if (hitTest && anchors && xr.baseExperience.state === BABYLON.WebXRState.IN_XR) {
            anchors.addAnchorPointUsingHitTestResultAsync(hitTest);
        }
    }

    const planes = [];

    xrPlanes.onPlaneAddedObservable.add(plane => {
        plane.polygonDefinition.push(plane.polygonDefinition[0]);
        var polygon_triangulation = new BABYLON.PolygonMeshBuilder("name", plane.polygonDefinition.map((p) => new BABYLON.Vector2(p.x, p.z)), scene);
        var polygon = polygon_triangulation.build(false, 0.01);
        plane.mesh = polygon; //BABYLON.TubeBuilder.CreateTube("tube", { path: plane.polygonDefinition, radius: 0.02, sideOrientation: BABYLON.Mesh.FRONTSIDE, updatable: true }, scene);
        //}
        planes[plane.id] = (plane.mesh);
        const mat = new BABYLON.StandardMaterial("mat", scene);
        mat.alpha = 0.5;
        mat.diffuseColor = BABYLON.Color3.Random();
        polygon.createNormals();
        // polygon.receiveShadows = true;
        plane.mesh.material = mat;

        plane.mesh.rotationQuaternion = new BABYLON.Quaternion();
        plane.transformationMatrix.decompose(plane.mesh.scaling, plane.mesh.rotationQuaternion, plane.mesh.position);
    });

    xrPlanes.onPlaneUpdatedObservable.add(plane => {
        let mat;
        if (plane.mesh) {
            mat = plane.mesh.material;
            plane.mesh.dispose(false, false);
        }
        const some = plane.polygonDefinition.some(p => !p);
        if (some) {
            return;
        }
        plane.polygonDefinition.push(plane.polygonDefinition[0]);
        var polygon_triangulation = new BABYLON.PolygonMeshBuilder("name", plane.polygonDefinition.map((p) => new BABYLON.Vector2(p.x, p.z)), scene);
        var polygon = polygon_triangulation.build(false, 0.01);
        polygon.createNormals();
        plane.mesh = polygon;// BABYLON.TubeBuilder.CreateTube("tube", { path: plane.polygonDefinition, radius: 0.02, sideOrientation: BABYLON.Mesh.FRONTSIDE, updatable: true }, scene);
        //}
        planes[plane.id] = (plane.mesh);
        plane.mesh.material = mat;
        plane.mesh.rotationQuaternion = new BABYLON.Quaternion();
        plane.transformationMatrix.decompose(plane.mesh.scaling, plane.mesh.rotationQuaternion, plane.mesh.position);
        plane.mesh.receiveShadows = true;
    })

    xrPlanes.onPlaneRemovedObservable.add(plane => {
        if (plane && planes[plane.id]) {
            planes[plane.id].dispose()
        }
    })

    xr.baseExperience.sessionManager.onXRSessionInit.add(() => {
        planes.forEach(plane => plane.dispose());
        while (planes.pop()) { };
    });



    return scene;

};
        window.initFunction = async function() {
            
            
            
            var asyncEngineCreation = async function() {
                try {
                return createDefaultEngine();
                } catch(e) {
                console.log("the available createEngine function failed. Creating the default engine instead");
                return createDefaultEngine();
                }
            }

            window.engine = await asyncEngineCreation();
if (!engine) throw 'engine should not be null.';
startRenderLoop(engine, canvas);
window.scene = createScene();};
initFunction().then(() => {scene.then(returnedScene => { sceneToRender = returnedScene; });
                    
});

// Resize
window.addEventListener("resize", function () {
    engine.resize();
});