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

import requirements from './cloudReqs.json';
import clusters from './cloudReqClusters.json';

type classArguments = {
    debug: boolean;
}

interface Requirement {
    reqID: number;
    requirementText: string;
    clusterID: number;
    relatedClusters: number[];
}

interface Cluster {
    clusterID: number;
    clusterName: string;
    clusterDescription: string;
    subClusters: string[];
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

    _reqsCreated: boolean = false;

    _requirements: Requirement[] = requirements.requirements;
    _clusters: Cluster[] = clusters.clusters;


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
            console.log('REQLAB AR CLOUD VERSION STARTED!');
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
        this.generatePointCloudFromRequirements(this._requirements, new Vector3(1, 1, 1));
        console.log("Test");
        

        //TODO: Implement cloud view initialization of requirement objects
        

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
                        //TODO: Implement "B" button functionality
                    });
                }
                

                if (buttonComponent) {
                    buttonComponent.onButtonStateChangedObservable.add((component) => {
                       //TODO: Implement "A" button functionality
                        
                    });
                }

                thumbstickComponent.onAxisValueChangedObservable.add((component) => {
                   //TODO: Implement thumbstick functionality
                });

                triggerComponent.onButtonStateChangedObservable.add((component) => {
                    if (component.pressed && component.value > 0.8) {

                        const resultRay = this.createRayFromController(motionControllerAdded);
                        const raycastHit = this._scene.pickWithRay(resultRay);

                        if (raycastHit && raycastHit.hit && raycastHit.pickedMesh) {
                            if (!this._reqsCreated) {
                               this.addAnchorAtPosition(raycastHit);
                            }
                            

                            if (raycastHit.pickedMesh.name.includes('vertical') ||
                                (raycastHit.pickedMesh.name.includes('horizontal') && raycastHit.pickedMesh.position.y > 0.5)) {
                                (this._debug) && console.log('hit a plane other than the floor');
                                return;
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
        let anchorPosition: Vector3 = raycastHit.pickedPoint!;
        anchorPosition.y = anchorPosition.y + 1;

        let overallParentNode: TransformNode = new TransformNode("parentNode", this._scene);

        this._xrAnchors!.addAnchorAtPositionAndRotationAsync(anchorPosition).then((anchor) => {
            anchor.attachedNode = overallParentNode;
            //TODO: Implement anchor functionality
            this._clusters.forEach((cluster, index) => {
                let filteredReqs = this._requirements.filter((req) => req.clusterID === cluster.clusterID);
                const points = this.generatePointCloudFromRequirements(this._requirements.filter((req) => req.clusterID === cluster.clusterID), new Vector3(1, 1, 1));

                let parentNode: TransformNode = new TransformNode("cloud" + index + "Node", this._scene);

                parentNode.position.x = parentNode.position.x - 2 + (index * 4/this._clusters.length);

                parentNode.parent = overallParentNode;

                let planes: Mesh[] = [];
                let buttons: GuiButton[] = [];

                filteredReqs.forEach((req, index) => {
                    let plane = MeshBuilder.CreatePlane("plane", {size: 1.5}, this._scene);

                    plane.parent = parentNode;
                    plane.position = points[index];

                    plane.billboardMode = Mesh.BILLBOARDMODE_Y;

                    const advancedTexture = AdvancedDynamicTexture.CreateForMesh(plane);

                    var button = GuiButton.CreateSimpleButton("btn", req.requirementText);
                    button.width = 0.5;
                    button.height = "100px";
                    button.color = "black";
                    button.fontSize = 30;
                    button.background = "";
                    button.thickness = 1;
                    button.cornerRadius = 20;

                    var buttonBackGround = new Rectangle("");
                    buttonBackGround.color = "";
                    buttonBackGround.thickness = 0;
                    buttonBackGround.background = "lightblue";
                    buttonBackGround.alpha = 1;
                    buttonBackGround.zIndex = -1;
                    button.addControl(buttonBackGround);

                    advancedTexture.addControl(button); 

                    planes.push(plane);
                    buttons.push(button);
                });
                this._reqsCreated = true;

            });
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

    getRandomFloat(min: number, max: number): number {
        return Math.random() * (max - min) + min;
    }

    generatePointCloudFromRequirements(requirements: Requirement[], range: Vector3) {
        console.dir(requirements);
        const points: Vector3[] = [];
        const stepX = range.x / Math.cbrt(requirements.length)*2;
        const stepY = range.y / Math.cbrt(requirements.length);
        const stepZ = range.z / Math.cbrt(requirements.length);

        const loop1 = Math.cbrt(requirements.length);
        const loop2 = Math.cbrt(requirements.length);
        const loop3 = Math.cbrt(requirements.length) - 1;

        for (let i = 0; i < loop1; i++) {
            for (let j = 0; j < loop2; j++) {
              for (let k = 0; k < loop3; k++) {
                points.push(new Vector3(i * stepX + this.getRandomFloat(-0.2, 0.2), j * stepY + this.getRandomFloat(-0.2, 0.2), k * stepZ + this.getRandomFloat(-0.2, 0.2)));
              }
            }
        }
        
        // Shuffle points to make them appear more randomly distributed
        /* for (let i = points.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [points[i], points[j]] = [points[j], points[i]];
        } */
        let difference = points.length - requirements.length;
        let start = Math.round(difference / 2);
        let end = Math.round(points.length - (difference / 2));
        console.log("Choosing points from " + start + " to " + end + " out of " + points.length);
        console.dir(points.slice(start, end));
        return points.slice(start, end);
    }

}

new XrExperience({ debug: true });