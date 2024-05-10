import {
    Engine,
    Scene,
    Vector3,
    WebXRDefaultExperience,
    MeshBuilder,
    Quaternion,
    StandardMaterial,
    Color3,
    WebXRPlaneDetector,
    ShadowGenerator,
    DirectionalLight,
    PolygonMeshBuilder,
    Vector2,
    IWebXRPlane,
    Mesh,
    Nullable,
    WebXRFeatureName,
    IShadowLight,
    HemisphericLight,
    WebXRFeaturesManager,
    WebXRHitTest,
    IWebXRHitResult,
    WebXRInputSource,
    Ray,
    Animation,
    IAnimationKey,
    WebXRAnchorSystem,
    IWebXRAnchor,
    SceneLoader,
    PickingInfo,
    AbstractMesh,
    TransformNode,
    PBRMetallicRoughnessMaterial,
} from '@babylonjs/core';

import '@babylonjs/loaders/glTF';
import { Button as GuiButton } from '@babylonjs/gui';

import { Inspector } from '@babylonjs/inspector';
import { AdvancedDynamicTexture, Button3D, Rectangle, TextBlock } from '@babylonjs/gui';
import { Button } from '@babylonjs/inspector/components/Button';

type classArguments = {
    debug: boolean;
}

type SessionModes = "immersive-ar" | "immersive-vr" | "inline";

type ReferenceSpaceType = "local-floor" | "bounded-floor" | "unbounded" | "local" | "viewer";

enum TetrisMeshes {
        Red = 'Red',
        Blue = 'Blue',
        Green = 'Green',
        Yellow = 'Yellow',
        Container = '__root__',
}


class XrExperience {
    _canvas: HTMLCanvasElement;
    _engine: Engine;
    _scene: Scene;
    _debug: boolean;
    _xr: WebXRDefaultExperience | null;
    _sessionMode: SessionModes;
    _referenceSpaceType: ReferenceSpaceType;
    _optionalFeatures: boolean;
    _fm: WebXRFeaturesManager | null;
    _shadowGenerator: Nullable<ShadowGenerator>;
    _xrPlanes: WebXRPlaneDetector | null;
    _xrHitTest: WebXRHitTest | null;
    _xrAnchors: WebXRAnchorSystem | null;
    _hitTest: IWebXRHitResult | undefined;
    _planes: Mesh[] = [];
    _marker: Mesh | null;
    _box: Mesh | null;
    _tetrisRed: AbstractMesh | null;
    _tetrisRedOgPos: Vector3 | null;
    _tetrisBlue: AbstractMesh | null;
    _tetrisBlueOgPos: Vector3 | null;
    _tetrisGreen: AbstractMesh | null;
    _tetrisGreenOgPos: Vector3 | null;
    _tetrisYellow: AbstractMesh | null;
    _tetrisOgStartPos: Vector3[];
    _tetrisYellowOgPos: Vector3 | null;
    _tetrisContainer: AbstractMesh | null;
    _tetrisContainerOgPos: Vector3 | null;
    _tetrisIsExtended: boolean;
    _tetrisIsPlaced: boolean;
    _focusedMesh: AbstractMesh | null;
    _centerPoint: Vector3 | null;
    _animationLock: boolean;


    /**
     * Constructs a new instance of the class.
     * @throws {string} Throws an error if WebGL is not supported.
     */
    constructor(args: classArguments) {
        if (!Engine.isSupported()) {
            throw 'WebGL not supported';
        }

        this._canvas = document.getElementById('canvas') as HTMLCanvasElement;
        this._engine = new Engine(this._canvas, true);
        this._scene = new Scene(this._engine);
        this._debug = args.debug;
        this._sessionMode = "immersive-ar";
        this._referenceSpaceType = "local-floor";
        this._optionalFeatures = true;
        this._xr = null;
        this._fm = null;
        this._shadowGenerator = null;
        this._xrHitTest = null;
        this._xrPlanes = null;
        this._xrAnchors = null;
        this._hitTest = undefined;
        this._planes = [];
        this._marker = null;
        this._box = null;
        this._tetrisRed = null;
        this._tetrisRedOgPos = null;
        this._tetrisBlue = null;
        this._tetrisBlueOgPos = null;
        this._tetrisGreen = null;
        this._tetrisGreenOgPos = null;
        this._tetrisYellow = null;
        this._tetrisYellowOgPos = null;
        this._tetrisOgStartPos = [];
        this._tetrisContainer = null;
        this._tetrisContainerOgPos = null;
        this._tetrisIsExtended = false;
        this._tetrisIsPlaced = false;
        this._focusedMesh = null;
        this._centerPoint = null;
        this._animationLock = false;

        this.createXrExperience().then(() => {
            this.addFeaturesToSession();
            this.createScene().then(() => {
                this._engine.runRenderLoop(() => {
                    this._scene.render();
                });
                window.addEventListener('resize', () => {
                    this._engine.resize();
                });
            });
            console.log('SCENE 9 CREATED');
        }).catch((error) => {
            console.log(error);
        });
    }


    /**
     *  Enables the WebXR default experience helper
        This enables default XR features such as as session, a camera, xr input, default UI to enter XR and scene transitions.
        We also configure the session to use AR and floor tracking.
        All optional features are enabled to allow for the most immersive experience..
     *  @returns A promise that resolves when the XR experience is created.
     */
    async createXrExperience(): Promise<void> {
        this._xr = await WebXRDefaultExperience.CreateAsync(this._scene, {
            uiOptions: {
                sessionMode: this._sessionMode,
                referenceSpaceType: this._referenceSpaceType,
            },
            optionalFeatures: this._optionalFeatures,
        });

        if (!this._xr.baseExperience) {
            throw new Error('Unable to create XR experience');
        }
    }


    /**
     * Adds features to the session.
     */
    addFeaturesToSession() {
        if (this._xr === null) {
            return;
        }
        // Get the features manager from the default xr experience
        this._fm = this._xr.baseExperience.featuresManager;

        try {
            this._xrPlanes = this._fm.enableFeature(WebXRFeatureName.PLANE_DETECTION, "latest") as WebXRPlaneDetector;
            this._xrHitTest = this._fm.enableFeature(WebXRFeatureName.HIT_TEST, "latest") as WebXRHitTest;
            this._xrAnchors = this._fm.enableFeature(WebXRFeatureName.ANCHOR_SYSTEM, "latest") as WebXRAnchorSystem;
        } catch (error) {
            console.log(error);
        }


    }

    /**
     * Creates the scene for the XR experience.
     * This function is called once when the scene is first created.
     * @returns A promise that resolves when the scene is created.
     */
    async createScene(): Promise<Scene> {

        this.createLightsAndShadows();
        this.createPlaneMeshesFromXrPlane();
        this.createTetrisT();

        if (this._xrAnchors && this._xrAnchors.isCompatible()) {

            this.observeAnchors();
            this.handleControllerSelection();
        }

        if (this._debug) Inspector.Show(this._scene, {});

        return this._scene;
    }


    /**
     * Creates a shadow generator for the scene.
     * ! shadowGenerator can only be created with a directional light
     * @returns A shadow generator.
     */
    createLightsAndShadows() {
        const lights = this.createLights();

        const shadowGenerator = new ShadowGenerator(1024, lights as IShadowLight);

        shadowGenerator.useBlurExponentialShadowMap = true;
        shadowGenerator.blurKernel = 32;

        this._shadowGenerator = shadowGenerator;
    }


    /**
     * Creates a light for the scene.
     * @returns A directional light.
     */
    createLights() {

        const directionalLight = new DirectionalLight("directionalLight", new Vector3(0, 0, 10), this._scene);
        directionalLight.intensity = 0.3;

        const hemiLight = new HemisphericLight("hemisphericLight", new Vector3(0, 1, 0), this._scene);
        hemiLight.intensity = 0.7;

        return directionalLight;
    }


    /**
     * Creates a plane mesh from a detected plane.
     * @param xrPlane The detected plane.
     * @returns A plane mesh.
     */
    createPlaneMeshesFromXrPlane(): void {
        interface IWebXRPlaneWithMesh extends IWebXRPlane {
            mesh?: Mesh;
        }

        let mat: Nullable<StandardMaterial>;

        if (this._xrPlanes === null) {
            return;
        }

        this._xrPlanes.onPlaneAddedObservable.add((plane: IWebXRPlaneWithMesh) => {
            this._debug && console.log("plane added", plane);
            mat = new StandardMaterial("mat", this._scene);
            mat.alpha = 0.35;
            mat.diffuseColor = Color3.Random();
            this.initPolygon(plane, mat);
        });

        this._xrPlanes.onPlaneUpdatedObservable.add((plane: IWebXRPlaneWithMesh) => {
            if (this._planes[plane.id].material) {
                mat = this._planes[plane.id].material as StandardMaterial;
                this._planes[plane.id].dispose(false, false);
            }
            const some = plane.polygonDefinition.some(p => !p);
            if (some) {
                return;
            }
            this.initPolygon(plane, mat!);
        });

        this._xrPlanes.onPlaneRemovedObservable.add((plane: IWebXRPlaneWithMesh) => {
            if (plane && this._planes[plane.id]) {
                this._planes[plane.id].dispose()
            }
        })

        if (this._xr !== null) {
            this._xr.baseExperience.sessionManager.onXRSessionInit.add(() => {
                this._planes.forEach((plane: Mesh) => plane.dispose());
                while (this._planes.pop());
            });
        }
    }


    /**
     * Initializes the polygon that represents the plane.
     * @param plane The plane.
     * @param mat The material.
     */
    initPolygon(plane: IWebXRPlane, mat?: StandardMaterial): Mesh {
        plane.polygonDefinition.push(plane.polygonDefinition[0]);
        const polygonTriangulation = new PolygonMeshBuilder(plane.xrPlane.orientation + plane.id, plane.polygonDefinition.map((p) => new Vector2(p.x, p.z)), this._scene);
        const polygon = polygonTriangulation.build(false, 0.01);

        polygon.createNormals(false);

        if (mat) {
            polygon.material = mat;
        }

        polygon.rotationQuaternion = new Quaternion();
        polygon.checkCollisions = true;
        polygon.receiveShadows = true;

        plane.transformationMatrix.decompose(polygon.scaling, polygon.rotationQuaternion, polygon.position);

        this._planes[plane.id] = (polygon);

        return polygon;
    }


    /**
     * Handles controller selection.
     */
    handleControllerSelection() {

        if (this._xr === null) {
            return;
        }
        this._xr.input.onControllerAddedObservable.add((motionControllerAdded) => {
            motionControllerAdded.onMotionControllerInitObservable.add((motionControllerInit) => {

                const motionControllerComponentIds = motionControllerInit.getComponentIds();
                const triggerComponent = motionControllerInit.getComponent(motionControllerComponentIds[0]);
                const buttonComponent = motionControllerInit.getComponent(motionControllerComponentIds[3]);

                if (buttonComponent) {
                    buttonComponent.onButtonStateChangedObservable.add((component) => {
                        if (component.pressed && this._animationLock === false) {
                            (this._tetrisIsExtended) ? this.retractTetris() : this.extendTetris();
                        }
                    });
                }

                triggerComponent.onButtonStateChangedObservable.add((component) => {
                    if (component.pressed && component.value > 0.8) {

                        const resultRay = this.createRayFromController(motionControllerAdded);
                        const raycastHit = this._scene.pickWithRay(resultRay);

                        if (raycastHit && raycastHit.hit && raycastHit.pickedMesh) {

                            if (raycastHit.pickedMesh.name.includes('vertical') ||
                                (raycastHit.pickedMesh.name.includes('horizontal') && raycastHit.pickedMesh.position.y > 0.5)) {
                                (this._debug) && console.log('hit a plane other than the floor');
                                return;
                            }

                            if (raycastHit.pickedMesh === this._box) {
                                const mat = this._box!.material as StandardMaterial;
                                mat.diffuseColor = Color3.Random();
                                this._box!.material = mat;
                            }

                            /* if (raycastHit.pickedMesh === this._tetrisRed ||
                                raycastHit.pickedMesh === this._tetrisBlue ||
                                raycastHit.pickedMesh === this._tetrisGreen ||
                                raycastHit.pickedMesh === this._tetrisYellow) {
                                this.animateTetris();
                            } */
                            
                            if (!this._tetrisIsPlaced) {
                                (this._debug) ?? console.log(raycastHit);
                                this.addAnchorAtPosition(raycastHit);
                            }
                        }
                    }
                });
            });
        });
    }


    /**
     * Creates a ray from the controller.
     * @param controller The controller to create the ray from.
     * @returns A ray.
     */
    createRayFromController(controller: WebXRInputSource): Ray {
        const origin = controller.pointer.position;
        const direction = controller.pointer.forward;
        return new Ray(origin, direction, length = 100);
    }


    /**
     * Adds an anchor at the specified position.
     * @param raycastHit The raycast hit information containing the picked point.
     */
    addAnchorAtPosition(raycastHit: PickingInfo) {

        this._xrAnchors!.addAnchorAtPositionAndRotationAsync(raycastHit.pickedPoint!).then((anchor) => {
        this._tetrisRed!.isVisible = true;
        this._tetrisBlue!.isVisible = true;
        this._tetrisGreen!.isVisible = true;
        this._tetrisYellow!.isVisible = true;
        
        anchor.attachedNode = this._tetrisContainer!;
        anchor.attachedNode.position = raycastHit.pickedPoint!;

        this._tetrisContainerOgPos = anchor.attachedNode.position.clone();
        this._tetrisRedOgPos = this._tetrisRed!.position.clone();
        this._tetrisBlueOgPos = this._tetrisBlue!.position.clone();
        this._tetrisGreenOgPos = this._tetrisGreen!.position.clone();
        this._tetrisYellowOgPos = this._tetrisYellow!.position.clone();
        this._tetrisIsPlaced = true;
        });
    }


    /**
     * Attaches an element to an anchor.
     * @param element The element to attach.
     */
    observeAnchors() {
        if (this._xrAnchors === null) {
            return;
        }
        this._xrAnchors.onAnchorAddedObservable.add((addedAnchor) => {
            this._xrAnchors!.anchors.forEach((anchor: IWebXRAnchor) => {
                if (anchor !== addedAnchor) {
                    anchor.remove();
                }
            });
        })
    }

    

    createTetrisT() {
        SceneLoader.Append("/models/", "TetrisAnimation.glb", this._scene, ((scene: Scene) => {
            this._tetrisRed = scene.getMeshByName(TetrisMeshes.Red);
            this._tetrisBlue = scene.getMeshByName(TetrisMeshes.Blue);
            this._tetrisGreen = scene.getMeshByName(TetrisMeshes.Green);
            this._tetrisYellow = scene.getMeshByName(TetrisMeshes.Yellow);
            this._tetrisContainer = scene.getMeshByName(TetrisMeshes.Container);

            const meshes = this._tetrisContainer!.getChildMeshes();

            meshes.forEach((mesh) => {
                if (mesh) {
                    this._shadowGenerator!.addShadowCaster(mesh);
                    mesh.receiveShadows = true;
                }
            });

            this._tetrisRed!.isVisible = false;
            this._tetrisBlue!.isVisible = false;
            this._tetrisGreen!.isVisible = false;
            this._tetrisYellow!.isVisible = false;
        }));
    }

    animateTetris(): void {
        const directions = {
            Red: new Vector3(0, 0, 0),
            Blue: new Vector3(0, 0, -1),
            Green: new Vector3(0, 1, 0),
            Yellow: new Vector3(0, 0, 1),
        }
        
        //const meshes = this._tetrisContainer!.getChildMeshes();

        const meshes = [this._tetrisRed, this._tetrisBlue, this._tetrisGreen, this._tetrisYellow];

        let animations: Animation[] = [];

        this._animationLock = true;

        
        meshes.forEach((mesh, index) => {
            if (mesh) {
                if(!this._tetrisIsExtended) {
                    this._animationLock = true;
                    this._scene.beginAnimation(mesh, 0, mesh.animations[0].getHighestFrame(), false, 1, () => {
                        this._animationLock = false;
                    });
                } else {
                    this._animationLock = true;
                    this._scene.beginAnimation(mesh, mesh.animations[0].getHighestFrame(), 0, false, 1, () => {
                        this._animationLock = false;
                    });
                }
                
                if (mesh.getChildMeshes().length === 0) {
                    // ---------- Add GUI Panel ----------
                    let plane = MeshBuilder.CreatePlane("plane", {size: 1.5}, this._scene);
                    plane.parent = mesh;
                    plane.position.y = 0.3;

                    plane.billboardMode = Mesh.BILLBOARDMODE_Y;

                    const advancedTexture = AdvancedDynamicTexture.CreateForMesh(plane);
                    //advancedTexture.addControl(text1);

                    var button1 = GuiButton.CreateSimpleButton("but1", mesh.name);
                    button1.width = 0.5;
                    button1.height = 0.2;
                    button1.color = "white";
                    button1.fontSize = 30;
                    button1.background = "gray";
                    button1.onPointerUpObservable.add(() => {
                        if(this._focusedMesh === mesh) {                            //deselect highlightet part
                            this._focusedMesh.scaling = new Vector3(1, 1, 1);
                            this._focusedMesh = null;
                        } else {                                                    //select new part to highlight
                            if (this._focusedMesh) {
                                this._focusedMesh.scaling = new Vector3(1, 1, 1);
                            }    
                            this._focusedMesh = mesh;
                            this._focusedMesh.scaling = new Vector3(1.3, 1.3, 1.3);
                        }
                        
                    });
                    advancedTexture.addControl(button1);
                };
                
                
            }
        });
        if (this._tetrisIsExtended) {
            meshes.forEach((mesh) => {
                mesh!.getChildMeshes().forEach((childMesh) => {
                    childMesh.isVisible = false;
                });
            });
        } else {
            meshes.forEach((mesh) => {
                mesh!.getChildMeshes().forEach((childMesh) => {
                    childMesh.isVisible = true;
                });
            });
        }
        this._tetrisIsExtended = !this._tetrisIsExtended;
    }

    extendTetris() {
        this.animateTetris();
        this._tetrisIsExtended = true;
    }

    retractTetris() {
        this.animateTetris();
        this._tetrisIsExtended = false;
    }

}

new XrExperience({ debug: true });