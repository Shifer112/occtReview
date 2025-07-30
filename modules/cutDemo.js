import initOpenCascade from 'opencascade.js';
import * as THREE from 'three';
import visualize from './visualize.js';

let ocPromise = null;

const getOC = () => {
  if (!ocPromise) {
    ocPromise = initOpenCascade({
      locateFile: (file) => `./resources/occt/${file}`,
    });
  }
  return ocPromise;
};

const makeBox = (oc, { x, y, z }) => new oc.BRepPrimAPI_MakeBox_2(x, y, z).Shape();

const makeCylinder = (oc, { r, h, angle = 2 * Math.PI }) =>
  new oc.BRepPrimAPI_MakeCylinder_2(r, h, angle).Shape();

const filletAllEdges = (oc, shape, radius, dims) => {
  const safeRadius = Math.min(radius, Math.min(dims.x, dims.y, dims.z) / 2 - 0.01);
  if (safeRadius <= 0) return shape;

  const mk = new oc.BRepFilletAPI_MakeFillet(
    shape,
    oc.ChFi3d_FilletShape.ChFi3d_Rational,
  );

  const exp = new oc.TopExp_Explorer_2(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_EDGE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE,
  );

  for (; exp.More(); exp.Next()) {
    mk.Add_2(safeRadius, oc.TopoDS.Edge_1(exp.Current()));
  }

  mk.Build(new oc.Message_ProgressRange_1());
  return mk.Shape();
};

const translateShape = (oc, shape, { dx = 0, dy = 0, dz = 0 }) => {
  if (!dx && !dy && !dz) return shape;
  const trsf = new oc.gp_Trsf_1();
  trsf.SetTranslation_1(new oc.gp_Vec_4(dx, dy, dz));
  return new oc.BRepBuilderAPI_Transform_2(shape, trsf, false).Shape();
};

const rotateShape = (oc, shape, { axis = 'x', angle = 0 }) => {
  if (angle === 0) return shape;
  const dir = axis === 'y'
    ? new oc.gp_Dir_4(0, 1, 0)
    : axis === 'z'
    ? new oc.gp_Dir_4(0, 0, 1)
    : new oc.gp_Dir_4(1, 0, 0);
  const ax1 = new oc.gp_Ax1_2(new oc.gp_Pnt_3(0, 0, 0), dir);
  const trsf = new oc.gp_Trsf_1();
  trsf.SetRotation_1(ax1, angle);
  return new oc.BRepBuilderAPI_Transform_2(shape, trsf, false).Shape();
};

export default async function createCutMesh(scene, tessellationOptions, gui) {
  const oc = await getOC();

  const parameters = {
    baseX: 100,
    baseY: 100,
    baseZ: 100,
    grooveX: 5,
    grooveY: 90,
    grooveZ: 5,
    cyls: [
      { r: 3, h: 3, dy: 85, dz: 85 },
      { r: 3, h: 3, dy: 15, dz: 85 },
      { r: 3, h: 3, dy: 85, dz: 15 },
      { r: 3, h: 3, dy: 15, dz: 15 },
    ],
    filletR: 5,
    deflection: tessellationOptions.deflection,
    angularDeflection: tessellationOptions.angularDeflection,
    wireframe: false,
  };

  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.6,
    metalness: 0,
    wireframe: parameters.wireframe,
  });

  const build = () => {
    const baseDims = {
      x: parameters.baseX,
      y: parameters.baseY,
      z: parameters.baseZ,
    };

    const grooveDims = {
      x: parameters.grooveX,
      y: parameters.grooveY,
      z: parameters.grooveZ,
    };

    const tessellation = {
      deflection: parameters.deflection,
      angularDeflection: parameters.angularDeflection,
    };

    let shape = makeBox(oc, baseDims);
    shape = filletAllEdges(oc, shape, parameters.filletR, baseDims);

    const grooveRaw = makeBox(oc, grooveDims);
    const dx = -grooveDims.x * 0.2;
    const dy = (baseDims.y - grooveDims.y) / 2;
    const dz = (baseDims.z - grooveDims.z) / 2;
    const groove = translateShape(oc, grooveRaw, { dx, dy, dz });

    let cutOp = new oc.BRepAlgoAPI_Cut_3(shape, groove, new oc.Message_ProgressRange_1());
    cutOp.Build(new oc.Message_ProgressRange_1());
    shape = cutOp.Shape();

    parameters.cyls.forEach(({ r, h, dy: cydy, dz: cydz }) => {
      const cylRaw = makeCylinder(oc, { r, h });
      const cylRot = rotateShape(oc, cylRaw, { axis: 'y', angle: Math.PI / 2 });
      const cyl = translateShape(oc, cylRot, { dx, dy: cydy, dz: cydz });
      cutOp = new oc.BRepAlgoAPI_Cut_3(shape, cyl, new oc.Message_ProgressRange_1());
      cutOp.Build(new oc.Message_ProgressRange_1());
      shape = cutOp.Shape();
    });

    new oc.BRepMesh_IncrementalMesh_2(
      shape,
      tessellation.deflection,
      false,
      tessellation.angularDeflection,
      false,
    );

    const geometries = visualize(oc, shape, tessellation);
    const group = new THREE.Group();

    geometries.forEach((geometry) => {
      const mesh = new THREE.Mesh(geometry, material);
      group.add(mesh);
    });

    group.position.set(-baseDims.x / 2, -baseDims.y / 2, -baseDims.z / 2);
    return group;
  };

  let currentMesh = build();
  scene.add(currentMesh);

  const updateMesh = () => {
    material.wireframe = parameters.wireframe;

    scene.remove(currentMesh);
    currentMesh.traverse((node) => {
      if (node.isMesh) node.geometry.dispose();
    });

    currentMesh = build();
    scene.add(currentMesh);
  };

  if (gui) {
    const folderBase = gui.addFolder('Base Box');
    folderBase.add(parameters, 'baseX', 1, 200, 0.1).onFinishChange(updateMesh);
    folderBase.add(parameters, 'baseY', 1, 200, 0.1).onFinishChange(updateMesh);
    folderBase.add(parameters, 'baseZ', 1, 200, 0.1).onFinishChange(updateMesh);
    folderBase.close();

    const folderGroove = gui.addFolder('Groove Box');
    folderGroove.add(parameters, 'grooveX', 1, 200, 0.1).onFinishChange(updateMesh);
    folderGroove.add(parameters, 'grooveY', 1, 200, 0.1).onFinishChange(updateMesh);
    folderGroove.add(parameters, 'grooveZ', 1, 200, 0.1).onFinishChange(updateMesh);
    folderGroove.close();

    parameters.cyls.forEach((c, idx) => {
      const folder = gui.addFolder(`Cylinder ${idx + 1}`);
      folder.add(c, 'r', 1, 100, 1).onFinishChange(updateMesh);
      folder.add(c, 'h', 1, 300, 1).onFinishChange(updateMesh);
      folder.add(c, 'dy', -100, 100, 1).onFinishChange(updateMesh);
      folder.add(c, 'dz', -100, 100, 1).onFinishChange(updateMesh);
      folder.close();
    });

    gui.add(parameters, 'filletR', 0, 20, 0.1).onFinishChange(updateMesh);

    const folderTess = gui.addFolder('Tessellation');
    folderTess.add(parameters, 'deflection', 0.01, 100, 1).onFinishChange(updateMesh);
    folderTess.add(parameters, 'angularDeflection', 0.01, 100, 1).onFinishChange(updateMesh);
    folderTess.close();

    gui.add(parameters, 'wireframe').onChange(updateMesh);
  }
}