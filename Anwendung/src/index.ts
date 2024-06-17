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
    Axis,
    Space,
} from '@babylonjs/core';

import '@babylonjs/loaders/glTF';
import { Button as GuiButton } from '@babylonjs/gui';

import { Inspector } from '@babylonjs/inspector';
import { AdvancedDynamicTexture, Button3D, Rectangle, TextBlock } from '@babylonjs/gui';
import { Button } from '@babylonjs/inspector/components/Button';

type classArguments = {
    debug: boolean;
}

type Requirement = {
    id: string;
    partName: string | null;
    partAmount: number | null;
    requirements: string[];
}

type SessionModes = "immersive-ar" | "immersive-vr" | "inline";

type ViewMode = "explosion" | "cloud";

type ReferenceSpaceType = "local-floor" | "bounded-floor" | "unbounded" | "local" | "viewer";



class XrExperience {
    _canvas: HTMLCanvasElement;
    _engine: Engine;
    _scene: Scene;
    _debug: boolean;
    _xr: WebXRDefaultExperience | null;
    _sessionMode: SessionModes;
    _viewMode: ViewMode;
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
    _carRequirements: Requirement[] = [];
    _car: TransformNode | null;
    _carIsPlaced: boolean;
    _carIsExtended: boolean;
    _wheel: TransformNode | null;
    _wheelIsExtended: boolean;
    _wheelCloseUp: boolean;
    _lastCarPosition: Vector3 | null;
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
        this._viewMode = "explosion";                   // can be "cloud" or "explosion"
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
        this._carRequirements = [
            { id: '#1', partName: 'Wheel', partAmount: 4, requirements: ['The wheel has to pass CE certification to be driven at 360km/h.'] },
            { id: '#2', partName: 'Breakhub', partAmount: 4, requirements: ['The breakhub has to have sufficient cooling to sustain 10 laps around the Nürburgring without smoking.'] },
            { id: '#3', partName: 'Bodywork', partAmount: 1, requirements: ['The part should be painted in white car paint.'] },
            { id: '#4', partName: 'PorscheEmblem', partAmount: 1, requirements: ['The emblem should be covered in a protective coating to protect it from corrosion.'] },
            { id: '#5', partName: 'MainStructure', partAmount: 1, requirements: ['Each Passenger of the main structure has to be protected by airbags.'] },
            { id: '#6', partName: 'FrunkLid', partAmount: 1, requirements: ['The lid to the front storage has to be IP67 water- and dust resistant.'] },
            { id: '#7', partName: 'FrontLight', partAmount: 2, requirements: ['The lights should automatically detect incoming traffic.'] },
            { id: '#8', partName: 'Windows', partAmount: 1, requirements: ['The windows should be double glazed.'] },
            { id: '#9', partName: 'Spoiler', partAmount: 1, requirements: ['The rear wing has to be adjustable to increase downforce.'] },
            { id: '#10', partName: 'Tire', partAmount: 4, requirements: ['The tires should be semi-slicks.'] },
            { id: '#11', partName: 'Rim', partAmount: 4, requirements: ['The rims should be made of solid magnesium.'] },
            { id: '#12', partName: 'BreakDisk', partAmount: 4, requirements: ['The breakdiscs should be ceramic.'] },
        ]
        this._car = null;
        this._carIsPlaced = false;
        this._carIsExtended = false;
        this._wheel = null;
        this._wheelIsExtended = false;
        this._wheelCloseUp = false;
        this._lastCarPosition = new Vector3(0, 0, 0);

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
            console.log('REQLAB AR STARTED!');
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
            disableTeleportation: true,
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
        if (this._viewMode === "explosion") {
            this.createCar();
            this.createWheel();
        } else if (this._viewMode === "cloud") {
            //TODO: Implement cloud view initialization of requirement objects
        }
        

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
            mat.diffuseColor = Color3.White();
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

    rotateMesh(mesh: AbstractMesh, axis: Vector3, angle: number) {
        mesh.rotate(axis, angle, Space.LOCAL);
    }


    handleControllerSelection() {

        if (this._xr === null) {
            return;
        }
        this._xr.input.onControllerAddedObservable.add((motionControllerAdded) => {
            motionControllerAdded.onMotionControllerInitObservable.add((motionControllerInit) => {

                const motionControllerComponentIds = motionControllerInit.getComponentIds();
                const triggerComponent = motionControllerInit.getComponent(motionControllerComponentIds[0]);    // Upper trigger
                const buttonComponent = motionControllerInit.getComponent(motionControllerComponentIds[3]);     // The "A" button
                const buttonBComponent = motionControllerInit.getComponent(motionControllerComponentIds[4]);     // The "B" button
                const thumbstickComponent = motionControllerInit.getComponent(motionControllerComponentIds[2]); // The thumbstick

                if (buttonBComponent) {
                    buttonBComponent.onButtonStateChangedObservable.add((component) => {
                        console.log('Button B pressed');
                        this._wheelCloseUp = false;
                        this._wheelIsExtended = false;
                        this._carIsExtended = false;
                        if (this._lastCarPosition) {
                           this.addAnchorAtPosition(this._lastCarPosition); 
                        }
                    });
                }
                

                if (buttonComponent) {
                    buttonComponent.onButtonStateChangedObservable.add((component) => {
                        if (this._viewMode === "explosion") {
                            if (component.pressed && this._animationLock === false) {
                                if (this._wheelCloseUp) {
                                    this.animateWheel();
                                } else {
                                    this.animateCar();
                                }
                                
                            } 
                        }
                        
                    });
                }

                thumbstickComponent.onAxisValueChangedObservable.add((component) => {
                    const rootMesh = this._scene.getMeshById('__root__');
                    if (rootMesh) {
                        rootMesh.rotationQuaternion = Quaternion.RotationYawPitchRoll(rootMesh.rotation.y, rootMesh.rotation.x, rootMesh.rotation.z);
                    }
                    
                    const rotationSpeed = 0.5;
                    if (component.x > 0.3) {
                        if (rootMesh && rootMesh.rotationQuaternion) {
                            console.log('thumbstick right');
                            console.dir(rootMesh);
                            this.rotateMesh(rootMesh, Axis.Y, rotationSpeed);
                            //rootMesh.rotation.y = rootMesh.rotation.y + rotationSpeed;
                        }
                    } else if (component.x < -0.3) {
                        console.log('thumbstick left');
                    } else if (-0.3 < component.x && component.x < 0.3) {
                        console.log('thumbstick neutral');
                    }
                });

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
                            if (raycastHit.pickedMesh.name.includes('#2') || raycastHit.pickedMesh.name.includes('#1')) {
                                console.log('Hit a wheel');
                                this._wheelCloseUp = true;
                                this.addAnchorAtPosition(raycastHit.pickedPoint!, true);
                            }
                            if (raycastHit.pickedMesh.name.includes('horizontal')) {
                                this.addAnchorAtPosition(raycastHit.pickedPoint!);
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

    makeMeshesAppearWithoutChildMeshes(meshes: AbstractMesh[]) {
        meshes.forEach((mesh) => {
            mesh.isVisible = true;
            this.makeChildMeshesAppear(mesh);
        });
    }

    makeMeshesDisappear(meshes: AbstractMesh[]) {
        meshes.forEach((mesh) => {
            mesh.isVisible = false;
            this.makeChildMeshesDisappear(mesh);
        });
    }

    makeChildMeshesAppear(mesh: AbstractMesh) {
        mesh.getChildMeshes().forEach((childMesh) => {
            childMesh.isVisible = true;
        });
    }

    makeChildMeshesDisappear(mesh: AbstractMesh) {
        mesh.getChildMeshes().forEach((childMesh) => {
            childMesh.isVisible = false;
        });
    }


    /**
     * Adds an anchor at the specified position.
     * @param raycastHit The raycast hit information containing the picked point.
     */
    addAnchorAtPosition(raycastHit: Vector3, firstHit: boolean = false) {
        let editedPosition = new Vector3(raycastHit.x, raycastHit.y, raycastHit.z);
        if (firstHit && this._wheelCloseUp) {
            console.log('first hit');
            editedPosition = new Vector3(raycastHit.x + 0.7, raycastHit.y, raycastHit.z - 0.2);
        } else {
            if (this._wheelCloseUp) {
                editedPosition = new Vector3(raycastHit.x + 0.7, raycastHit.y + 0.7, raycastHit.z - 0.2);
            } else {
            editedPosition = new Vector3(raycastHit.x, raycastHit.y + 0.7, raycastHit.z);  
            }
        }
        
        

        this._xrAnchors!.addAnchorAtPositionAndRotationAsync(editedPosition).then((anchor) => {
        console.dir(anchor);
        const carMeshes = this._car!.getChildMeshes();
        const wheelMeshes = this._wheel!.getChildMeshes();

        if (this._wheelCloseUp === false) {
            this.makeMeshesAppearWithoutChildMeshes(carMeshes);
            this.makeMeshesDisappear(wheelMeshes);
            anchor.attachedNode = this._car!;
        } else {
            this.makeMeshesDisappear(carMeshes);
            this.makeMeshesAppearWithoutChildMeshes(wheelMeshes);
            anchor.attachedNode = this._wheel!;
        }
       
        anchor.attachedNode.position = editedPosition;
        console.dir(anchor.attachedNode);
        anchor.attachedNode.position.add(new Vector3(0, 1, 0));
        console.dir(anchor.attachedNode);
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

    addRequirementPanelToMesh(mesh: AbstractMesh, requirement: Requirement) {
        let plane = MeshBuilder.CreatePlane("plane", {size: 1.5}, this._scene);
        plane.parent = mesh;
        plane.position.y = -0.5;
        plane.rotation._x = Math.PI;
        //plane.rotate(Axis.X, Math.PI);

        plane.billboardMode = Mesh.BILLBOARDMODE_Y;

        const advancedTexture = AdvancedDynamicTexture.CreateForMesh(plane);
        //advancedTexture.addControl(text1);

        var button1 = GuiButton.CreateSimpleButton("but1", requirement.requirements[0]);
        button1.width = 0.5;
        button1.height = "100px";
        button1.color = "white";
        button1.fontSize = 30;
        button1.background = "";
        button1.thickness = 1;
        button1.cornerRadius = 20;

        var buttonBackGround = new Rectangle("");
        buttonBackGround.color = "";
        buttonBackGround.thickness = 0;
        buttonBackGround.background = "lightblue";
        buttonBackGround.alpha = 0.2;
        buttonBackGround.zIndex = -1;
        button1.addControl(buttonBackGround);

        advancedTexture.addControl(button1); 
    }

    createCar() {
        SceneLoader.Append("/models/", "BachelorCar.glb", this._scene, ((scene: Scene) => {
            this._car = scene.getTransformNodeByName("EntireChassis");
            
            const meshes = this._car!.getChildMeshes();

            meshes.forEach((mesh) => {
                if (mesh) {
                    this._shadowGenerator!.addShadowCaster(mesh);
                    mesh.receiveShadows = true;
                    mesh.isVisible = false;
                }
            });
            this._scene.stopAllAnimations();
        }));
    }

    animateCar() {
        console.log("Animating car");
        const meshes = this._car!.getChildMeshes();


        this._animationLock = true;

        meshes.forEach((mesh) => {
            if (mesh && mesh.animations.length > 0) {
                if(!this._carIsExtended) {
                    //extend car
                    this._animationLock = true;
                    this._scene.beginAnimation(mesh, 0, mesh.animations[0].getHighestFrame(), false, 1, () => {
                        this._animationLock = false;
                    });

                } else {
                    //close car
                    this._animationLock = true;
                    this._scene.beginAnimation(mesh, mesh.animations[0].getHighestFrame(), 0, false, 1, () => {
                        this._animationLock = false;
                    });

                }
            }
            if (mesh.getChildMeshes().length === 0) {   //create requirement planes if they dont exist already
                for (let i = 0; i < this._carRequirements.length; i++) {
                    if (mesh.name.includes(this._carRequirements[i].id + '_')) {
                        if (this._carRequirements[i].requirements?.length === 1) {
                            this.addRequirementPanelToMesh(mesh, this._carRequirements[i]); 

                        } else if (this._carRequirements[i].requirements?.length > 1) {

                        }
                    }
                }
            }
            if (this._carIsExtended) {
                this.makeChildMeshesDisappear(mesh);
            } else {
                this.makeChildMeshesAppear(mesh);
            }
        });

        this._carIsExtended = !this._carIsExtended;
    }


    createWheel() {
        SceneLoader.Append("/models/", "WheelAnimation.glb", this._scene, ((scene: Scene) => {
            this._wheel = scene.getTransformNodeByName("EntireWheel");          

            const meshes = this._wheel!.getChildMeshes();

            meshes.forEach((mesh) => {
                if (mesh) {
                    this._shadowGenerator!.addShadowCaster(mesh);
                    mesh.receiveShadows = true;
                    mesh.isVisible = false;
                }
            });
            this._scene.stopAllAnimations();
        }));
    }

    animateWheel() {
        const meshes = this._wheel!.getChildMeshes();

        this._animationLock = true;

        meshes.forEach((mesh) => {
            if (mesh && mesh.animations.length > 0) {
                if(!this._wheelIsExtended) {
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
            }
            if (mesh.getChildMeshes().length === 0) {   //create requirement planes if they dont exist already
                for (let i = 0; i < this._carRequirements.length; i++) {
                    if (mesh.name.includes(this._carRequirements[i].id + '_')) {
                        if (this._carRequirements[i].requirements?.length === 1) {
                            this.addRequirementPanelToMesh(mesh, this._carRequirements[i]); 

                        } else if (this._carRequirements[i].requirements?.length > 1) {

                        }
                    }
                }
            }
            if (this._wheelIsExtended) {
                mesh.getChildMeshes().forEach((childMesh) => {
                    childMesh.isVisible = false;
                })
            } else {
                mesh.getChildMeshes().forEach((childMesh) => {
                    childMesh.isVisible = true;
                })
            }
        });
        this._wheelIsExtended = !this._wheelIsExtended;
    } 

}

new XrExperience({ debug: true });