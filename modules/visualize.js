import * as THREE from 'three';

export default function visualize(openCascade, shape, tessellationOptions = {}) {
  const { deflection = 1.0, angularDeflection = 1.0 } = tessellationOptions;

  const geometries = [];
  const ExpFace = new openCascade.TopExp_Explorer_1();

  for (
    ExpFace.Init(
      shape,
      openCascade.TopAbs_ShapeEnum.TopAbs_FACE,
      openCascade.TopAbs_ShapeEnum.TopAbs_SHAPE
    );
    ExpFace.More();
    ExpFace.Next()
  ) {
    const myShape = ExpFace.Current();
    const myFace = openCascade.TopoDS.Face_1(myShape);

    const aLocation = new openCascade.TopLoc_Location_1();
    const myT = openCascade.BRep_Tool.Triangulation(myFace, aLocation, 0);
    if (myT.IsNull()) continue;

    const pc = new openCascade.Poly_Connect_2(myT);
    const triangulation = myT.get();

    const vertices = new Float32Array(triangulation.NbNodes() * 3);
    for (let i = 1; i <= triangulation.NbNodes(); i++) {
      const transform = aLocation.Transformation();
      const p = triangulation.Node(i).Transformed(transform);
      vertices[3 * (i - 1)] = p.X();
      vertices[3 * (i - 1) + 1] = p.Y();
      vertices[3 * (i - 1) + 2] = p.Z();
      transform.delete();
      p.delete();
    }

    const myNormal = new openCascade.TColgp_Array1OfDir_2(1, triangulation.NbNodes());
    openCascade.StdPrs_ToolTriangulatedShape.Normal(myFace, pc, myNormal);
    const normals = new Float32Array(myNormal.Length() * 3);
    for (let i = myNormal.Lower(); i <= myNormal.Upper(); i++) {
      const transform = aLocation.Transformation();
      const d = myNormal.Value(i).Transformed(transform);
      normals[3 * (i - 1)] = d.X();
      normals[3 * (i - 1) + 1] = d.Y();
      normals[3 * (i - 1) + 2] = d.Z();
      transform.delete();
      d.delete();
    }

    const orient = myFace.Orientation_1();
    const triangles = triangulation.Triangles();
    const triLength = triangles.Length() * 3;
    const indices = triLength > 65535 ? new Uint32Array(triLength) : new Uint16Array(triLength);

    for (let nt = 1; nt <= triangulation.NbTriangles(); nt++) {
      const t = triangles.Value(nt);
      let [n1, n2, n3] = [t.Value(1), t.Value(2), t.Value(3)];
      if (orient !== openCascade.TopAbs_Orientation.TopAbs_FORWARD) {
        [n1, n2] = [n2, n1];
      }
      indices[3 * (nt - 1)] = n1 - 1;
      indices[3 * (nt - 1) + 1] = n2 - 1;
      indices[3 * (nt - 1) + 2] = n3 - 1;
      t.delete();
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometries.push(geometry);

    myNormal.delete();
    pc.delete();
    aLocation.delete();
    myT.delete();
    myFace.delete();
    myShape.delete();
  }

  ExpFace.delete();
  return geometries;
}