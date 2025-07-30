import * as THREE from 'three';
import initOpenCascade from 'opencascade.js';
import visualize from './visualize.js';

const getOC = (() => {
  let ocPromise = null;
  return () => {
    if (!ocPromise) {
      ocPromise = initOpenCascade({
        locateFile: (file) => `./resources/occt/${file}`,
      });
    }
    return ocPromise;
  };
})();

const translateShape = (oc, shape, { dx = 0, dy = 0, dz = 0 }) => {
  if (!dx && !dy && !dz) return shape;
  const trsf = new oc.gp_Trsf_1();
  const vec = new oc.gp_Vec_4(dx, dy, dz);
  trsf.SetTranslation_1(vec);
  return new oc.BRepBuilderAPI_Transform_2(shape, trsf, false).Shape();
};

const getFaceHashes = (oc, shape) => {
  const explorer = new oc.TopExp_Explorer_2(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_FACE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE
  );
  const hashes = new Set();
  while (explorer.More()) {
    const face = explorer.Current();
    const hash = oc.TopoDS_Shape_HashCode(face, 1000000);
    hashes.add(hash);
    explorer.Next();
  }
  return hashes;
};

export const createCutMesh = async () => {
  const oc = await getOC();

  const box1 = new oc.BRepPrimAPI_MakeBox_2(10, 10, 10).Shape();
  const box2 = new oc.BRepPrimAPI_MakeBox_2(4, 10, 2).Shape();
  const box2Moved = translateShape(oc, box2, { dx: 2 });

  const box1FaceHashes = getFaceHashes(oc, box1);

  const range = new oc.Message_ProgressRange_1();
  const cutOp = new oc.BRepAlgoAPI_Cut_3(box1, box2Moved, range);
  cutOp.Build(range);
  const cutShape = cutOp.Shape();

  new oc.BRepMesh_IncrementalMesh_2(cutShape, 0.5, false, 0.5, true);

  const allGeometries = visualize(oc, cutShape);
  const geometriesCut = [];
  const geometriesBase = [];

  const explorer = new oc.TopExp_Explorer_2(
    cutShape,
    oc.TopAbs_ShapeEnum.TopAbs_FACE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE
  );

  let index = 0;
  while (explorer.More()) {
    const face = explorer.Current();
    const geom = allGeometries[index++];
    const hash = oc.TopoDS_Shape_HashCode(face, 1000000);

    if (box1FaceHashes.has(hash)) {
      geometriesBase.push(geom);
    } else {
      geometriesCut.push(geom);
    }

    explorer.Next();
  }

  const materialBase = new THREE.MeshStandardMaterial({ color: '#dddddd', wireframe: false });
  const materialCut = new THREE.MeshStandardMaterial({ color: '#ff4444', wireframe: false });

  const group = new THREE.Group();
  geometriesBase.forEach((geom) => group.add(new THREE.Mesh(geom, materialBase)));
  geometriesCut.forEach((geom) => group.add(new THREE.Mesh(geom, materialCut)));

  return group;
};
