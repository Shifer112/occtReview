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

const makeBox = (oc, { x, y, z }) => {
  return new oc.BRepPrimAPI_MakeBox_2(x, y, z).Shape();
};

const makeCylinder = (oc, { r, h, angle = 2 * Math.PI }) => {
  return new oc.BRepPrimAPI_MakeCylinder_2(r, h, angle).Shape();
};

const translateShape = (oc, shape, { dx = 0, dy = 0, dz = 0 }) => {
  if (!dx && !dy && !dz) return shape;
  
  const trsf = new oc.gp_Trsf_1();
  const vec = new oc.gp_Vec_4(dx, dy, dz);
  trsf.SetTranslation_1(vec);
  const transformed = new oc.BRepBuilderAPI_Transform_2(shape, trsf, false).Shape();
  
  trsf.delete();
  vec.delete();
  
  return transformed;
};

const rotateShape = (oc, shape, { axis = 'x', angle = 0 }) => {
  if (angle === 0) return shape;

  const dir = axis === 'y' ? new oc.gp_Dir_4(0, 1, 0) : axis === 'z' ? new oc.gp_Dir_4(0, 0, 1) : new oc.gp_Dir_4(1, 0, 0);
  const pnt = new oc.gp_Pnt_3(0, 0, 0);
  const ax1 = new oc.gp_Ax1_2(pnt, dir);
  const trsf = new oc.gp_Trsf_1();
  trsf.SetRotation_1(ax1, angle);
  const rotated = new oc.BRepBuilderAPI_Transform_2(shape, trsf, false).Shape();

  trsf.delete();
  ax1.delete();
  pnt.delete();
  dir.delete();

  return rotated;
};

const applyChamfer = (oc, shape, { distance = 5, edgeIndices = [] }) => {
  if (distance <= 0 || edgeIndices.length === 0) return shape;

  const chamferMaker = new oc.BRepFilletAPI_MakeChamfer(shape);
  const edges = [];
  const exp = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  for (; exp.More(); exp.Next()) edges.push(exp.Current());
  exp.delete();

  try {
    edgeIndices.forEach((idx) => {
      if (idx < edges.length) {
        const edge = oc.TopoDS.Edge_1(edges[idx]);
        chamferMaker.Add_2(distance, edge);
        edge.delete();
      }
    });

    chamferMaker.Build(new oc.Message_ProgressRange_1());
    if (chamferMaker.IsDone()) {
      return chamferMaker.Shape();
    }
  } catch (e) {
    console.error('Chamfer failed:', e);
  } finally {
    chamferMaker.delete();
  }
  return shape;
};

const applyFillet = (oc, shape, { radius = 5, edgeIndices = [] }) => {
  if (radius <= 0 || edgeIndices.length === 0) return shape;

  const filletMaker = new oc.BRepFilletAPI_MakeFillet(shape, oc.ChFi3d_FilletShape.ChFi3d_Rational);
  const edges = [];
  const exp = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  for (; exp.More(); exp.Next()) edges.push(exp.Current());
  exp.delete();

  try {
    edgeIndices.forEach((idx) => {
      if (idx < edges.length) {
        const edge = oc.TopoDS.Edge_1(edges[idx]);
        filletMaker.Add_2(radius, edge);
        edge.delete();
      }
    });

    filletMaker.Build(new oc.Message_ProgressRange_1());
    if (filletMaker.IsDone()) {
      return filletMaker.Shape();
    }
  } catch (e) {
    console.error('Fillet failed:', e);
  } finally {
    filletMaker.delete();
  }
  return shape;
};


const createOptimizedPart = (oc, parameters, tessellationOptions) => {
  const start = performance.now();
  const disposables = [];

  const base = makeBox(oc, { x: parameters.baseX, y: parameters.baseY, z: parameters.baseZ });
  disposables.push(base);

  const grooveRaw = makeBox(oc, { x: parameters.grooveX, y: parameters.grooveY, z: parameters.grooveZ });
  disposables.push(grooveRaw);
  
  const dx = -parameters.grooveX * 0.2;
  const dy = (parameters.baseY - parameters.grooveY) / 2;
  const dz = (parameters.baseZ - parameters.grooveZ) / 2;

  const builder = new oc.BRep_Builder();
  const compound = new oc.TopoDS_Compound();
  builder.MakeCompound(compound);
  disposables.push(builder, compound);

  const groove = translateShape(oc, grooveRaw, { dx, dy, dz });
  disposables.push(groove);
  builder.Add(compound, groove);

  parameters.cyls.forEach(({ r, h, dy: cydy, dz: cydz }) => {
    const baseCyl = makeCylinder(oc, { r, h });
    const rotatedCyl = rotateShape(oc, baseCyl, { axis: 'y', angle: Math.PI / 2 });
    const cyl = translateShape(oc, rotatedCyl, { dx, dy: cydy, dz: cydz });
    disposables.push(baseCyl, rotatedCyl, cyl);
    builder.Add(compound, cyl);
  });

  const cutOp = new oc.BRepAlgoAPI_Cut_3(base, compound, new oc.Message_ProgressRange_1());
  disposables.push(cutOp);
  cutOp.Build(new oc.Message_ProgressRange_1());
  let shape = cutOp.Shape();
  disposables.push(shape);

  if (parameters.enableChamfer && parameters.chamferEdges.length > 0) {
    const chamferedShape = applyChamfer(oc, shape, {
      distance: parameters.chamferDistance, edgeIndices: parameters.chamferEdges
    });
    if(chamferedShape.HashCode(2147483647) !== shape.HashCode(2147483647)) {
        disposables.push(chamferedShape);
        shape = chamferedShape;
    }
  }

  if (parameters.enableFillet && parameters.filletEdges.length > 0) {
    const filletedShape = applyFillet(oc, shape, {
      radius: parameters.filletRadius, edgeIndices: parameters.filletEdges
    });
    if(filletedShape.HashCode(2147483647) !== shape.HashCode(2147483647)) {
        disposables.push(filletedShape);
        shape = filletedShape;
    }
  }

  const cutFaceHashes = new Set();
  const generated = cutOp.Generated(compound);
  disposables.push(generated);
  for (let i = 1; i <= generated.Size(); i++) {
    const f = oc.TopoDS.Face_1(generated.Value(i));
    cutFaceHashes.add(f.HashCode(2147483647));
    f.delete();
  }

  const mainFaces = [];
  const cutFaces = [];
  const exp = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_FACE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  disposables.push(exp);
  while (exp.More()) {
    const f = oc.TopoDS.Face_1(exp.Current());
    if (cutFaceHashes.has(f.HashCode(2147483647))) {
      cutFaces.push(f);
    } else {
      mainFaces.push(f);
    }
    exp.Next();
  }

  const makeCompoundForVis = (faces) => {
    const b = new oc.BRep_Builder();
    const c = new oc.TopoDS_Compound();
    b.MakeCompound(c);
    faces.forEach((f) => b.Add(c, f));
    disposables.push(b);
    return c;
  };
  
  const mainCompound = makeCompoundForVis(mainFaces);
  const cutCompound = makeCompoundForVis(cutFaces);
  disposables.push(mainCompound, cutCompound);

  const mainGeometries = visualize(oc, mainCompound, tessellationOptions);
  const cutGeometries = visualize(oc, cutCompound, tessellationOptions);
  
  const buildTime = performance.now() - start;

  disposables.forEach(d => d.delete());
  mainFaces.forEach(f => f.delete());
  cutFaces.forEach(f => f.delete());

  return { geometries: { main: mainGeometries, cut: cutGeometries }, buildTime };
};


const createMaterial = (wireframe = false) =>
  new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.6, metalness: 0, wireframe
  });

const createPartGroup = (geometries, mainMat, cutMat, position) => {
  const group = new THREE.Group();
  geometries.main.forEach((g) => group.add(new THREE.Mesh(g, mainMat)));
  geometries.cut.forEach((g) => group.add(new THREE.Mesh(g, cutMat)));
  group.position.copy(position);
  return group;
};

const calculateGridPosition = (idx, gridSize, spacing) => {
  const row = Math.floor(idx / gridSize);
  const col = idx % gridSize;
  return new THREE.Vector3((col - gridSize / 2) * spacing, 0, (row - gridSize / 2) * spacing);
};

const logPerformanceStats = (stats) => {
  console.table(stats);
};

export default async function createCutMesh(scene, tessellationOptions, gui) {
  const oc = await getOC();

  const parameters = {
    baseX: 100, baseY: 100, baseZ: 100,
    grooveX: 5, grooveY: 90, grooveZ: 5,
    cyls: [
      { r: 3, h: 3, dy: 85, dz: 85 }, { r: 3, h: 3, dy: 15, dz: 85 },
      { r: 3, h: 3, dy: 85, dz: 15 }, { r: 3, h: 3, dy: 15, dz: 15 },
    ],
    deflection: 1, angularDeflection: 1,
    wireframe: false,
    partCount: 1,
    showAll: false,
    useVariations: false,
    enableChamfer: false, chamferDistance: 5, chamferEdges: [0, 1, 2, 3],
    enableFillet: false, filletRadius: 5, filletEdges: [4, 5, 6, 7],
  };

  const mainMaterial = createMaterial(parameters.wireframe);
  const cutMaterial = new THREE.MeshStandardMaterial({
    color: 0xcccccc, roughness: 0.8, metalness: 0, wireframe: parameters.wireframe,
  });

  let allParts = [];
  let performanceStats = {};

  const clearScene = () => {
    allParts.forEach((g) => {
      scene.remove(g);
      g.traverse((n) => n.isMesh && n.geometry.dispose());
    });
    allParts = [];
  };

  const runLoadTest = async () => {
    console.log(`Starting load test: ${parameters.partCount} parts`);
    const start = performance.now();
    const buildTimes = [];
    clearScene();

    for (let i = 0; i < parameters.partCount; i++) {
      let p = { ...parameters };
      if (parameters.useVariations) {
        const v = i % 10;
        p.baseX += v * 2; p.baseY += v * 2; p.grooveX += v * 0.2;
      }

      try {
        const tess = { deflection: p.deflection, angularDeflection: p.angularDeflection };
        const { geometries, buildTime } = createOptimizedPart(oc, p, tess);
        buildTimes.push(buildTime);

        const gridSize = Math.ceil(Math.sqrt(parameters.partCount));
        const spacing = 120;
        const group = createPartGroup(geometries, mainMaterial, cutMaterial, calculateGridPosition(i, gridSize, spacing));
        if (parameters.showAll || i === parameters.partCount - 1) scene.add(group);
        allParts.push(group);
      } catch (e) {
        console.error(`Part ${i + 1} failed`, e);
      }
    }

    const totalTime = performance.now() - start;
    performanceStats = {
      totalTime,
      averageTime: buildTimes.length > 0 ? buildTimes.reduce((a, b) => a + b, 0) / buildTimes.length : 0,
      minTime: buildTimes.length > 0 ? Math.min(...buildTimes) : 0,
      maxTime: buildTimes.length > 0 ? Math.max(...buildTimes) : 0,
      partsCreated: allParts.length,
    };
    logPerformanceStats(performanceStats);
    return performanceStats;
  };

  const updateMaterial = () => {
    mainMaterial.wireframe = parameters.wireframe;
    cutMaterial.wireframe = parameters.wireframe;
  };

  const updateMesh = async () => {
    updateMaterial();
    await runLoadTest();
  };

  if (gui) {
    const folderBase = gui.addFolder('Base Box');
    folderBase.add(parameters, 'baseX', 1, 200, 0.1).onFinishChange(updateMesh);
    folderBase.add(parameters, 'baseY', 1, 200, 0.1).onFinishChange(updateMesh);
    folderBase.add(parameters, 'baseZ', 1, 200, 0.1).onFinishChange(updateMesh);

    const setupEdgeSelection = (folder, paramName, edges) => {
        edges.forEach(index => {
            const control = { get edge() { return parameters[paramName].includes(index); }, set edge(v) {
                const set = new Set(parameters[paramName]);
                if (v) set.add(index); else set.delete(index);
                parameters[paramName] = [...set].sort((a,b) => a-b);
                updateMesh();
            }};
            folder.add(control, 'edge').name(`Edge ${index}`);
        });
    };

    const folderChamfer = gui.addFolder('Chamfer');
    folderChamfer.add(parameters, 'enableChamfer').onFinishChange(updateMesh);
    folderChamfer.add(parameters, 'chamferDistance', 0.1, 20, 0.1).onFinishChange(updateMesh);
    setupEdgeSelection(folderChamfer, 'chamferEdges', [0, 1, 2, 3]);

    const folderFillet = gui.addFolder('Fillet');
    folderFillet.add(parameters, 'enableFillet').onFinishChange(updateMesh);
    folderFillet.add(parameters, 'filletRadius', 0.1, 20, 0.1).onFinishChange(updateMesh);
    setupEdgeSelection(folderFillet, 'filletEdges', [4, 5, 6, 7]);
    
    const folderGroove = gui.addFolder('Groove Box');
    folderGroove.add(parameters, 'grooveX', 1, 200, 0.1).onFinishChange(updateMesh);
    folderGroove.add(parameters, 'grooveY', 1, 200, 0.1).onFinishChange(updateMesh);
    folderGroove.add(parameters, 'grooveZ', 1, 200, 0.1).onFinishChange(updateMesh);

    parameters.cyls.forEach((c, idx) => {
      const folder = gui.addFolder(`Cylinder ${idx + 1}`);
      folder.add(c, 'r', 1, 100, 1).onFinishChange(updateMesh);
      folder.add(c, 'h', 1, 300, 1).onFinishChange(updateMesh);
      folder.add(c, 'dy', -100, 100, 1).onFinishChange(updateMesh);
      folder.add(c, 'dz', -100, 100, 1).onFinishChange(updateMesh);
    });

    const folderTess = gui.addFolder('Tessellation');
    folderTess.add(parameters, 'deflection', 0.01, 100, 0.1).onFinishChange(updateMesh);
    folderTess.add(parameters, 'angularDeflection', 0.01, 100, 0.1).onFinishChange(updateMesh);

    const testFolder = gui.addFolder('Load Testing');
    testFolder.add(parameters, 'partCount', 1, 100, 1);
    testFolder.add(parameters, 'showAll').name('Show All Parts');
    testFolder.add(parameters, 'useVariations').name('Use Variations');
    testFolder.add({ runLoadTest }, 'runLoadTest').name('Run Test');
    testFolder.open();

    gui.add(parameters, 'wireframe').onChange(updateMaterial);
  }

  await runLoadTest();
  return {
    stats: performanceStats,
    runTest: runLoadTest,
    parts: allParts,
  };
}