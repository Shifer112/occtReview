import * as THREE from 'three';

export default function visualize(openCascade, shape, tessellationOptions = {}) {
  const { deflection = 1.0, angularDeflection = 1.0 } = tessellationOptions;
  const geometries = [];

  const shapes = Array.isArray(shape) ? shape : [shape];

  shapes.forEach((s) => {
    const exp = new openCascade.TopExp_Explorer_1();
    for (
      exp.Init(
        s,
        openCascade.TopAbs_ShapeEnum.TopAbs_FACE,
        openCascade.TopAbs_ShapeEnum.TopAbs_SHAPE
      );
      exp.More();
      exp.Next()
    ) {
      const faceHandle = exp.Current();
      const face = openCascade.TopoDS.Face_1(faceHandle);

      const loc = new openCascade.TopLoc_Location_1();
      const tri = openCascade.BRep_Tool.Triangulation(face, loc, 0);
      if (tri.IsNull()) {
        loc.delete();
        face.delete();
        faceHandle.delete();
        continue;
      }

      const pc = new openCascade.Poly_Connect_2(tri);
      const t = tri.get();

      const vertices = new Float32Array(t.NbNodes() * 3);
      for (let i = 1; i <= t.NbNodes(); i++) {
        const tr = loc.Transformation();
        const p = t.Node(i).Transformed(tr);
        vertices[3 * (i - 1)] = p.X();
        vertices[3 * (i - 1) + 1] = p.Y();
        vertices[3 * (i - 1) + 2] = p.Z();
        tr.delete();
        p.delete();
      }

      const normalsArr = new openCascade.TColgp_Array1OfDir_2(1, t.NbNodes());
      openCascade.StdPrs_ToolTriangulatedShape.Normal(face, pc, normalsArr);
      const normals = new Float32Array(normalsArr.Length() * 3);
      for (let i = normalsArr.Lower(); i <= normalsArr.Upper(); i++) {
        const tr = loc.Transformation();
        const d = normalsArr.Value(i).Transformed(tr);
        normals[3 * (i - 1)] = d.X();
        normals[3 * (i - 1) + 1] = d.Y();
        normals[3 * (i - 1) + 2] = d.Z();
        tr.delete();
        d.delete();
      }

      const orient = face.Orientation_1();
      const triangles = t.Triangles();
      const triLength = triangles.Length() * 3;
      const indices = triLength > 65535 ? new Uint32Array(triLength) : new Uint16Array(triLength);

      for (let nt = 1; nt <= t.NbTriangles(); nt++) {
        const triNode = triangles.Value(nt);
        let [n1, n2, n3] = [triNode.Value(1), triNode.Value(2), triNode.Value(3)];
        if (orient !== openCascade.TopAbs_Orientation.TopAbs_FORWARD) {
          [n1, n2] = [n2, n1];
        }
        indices[3 * (nt - 1)] = n1 - 1;
        indices[3 * (nt - 1) + 1] = n2 - 1;
        indices[3 * (nt - 1) + 2] = n3 - 1;
        triNode.delete();
      }
      
      triangles.delete();

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));
      geometries.push(geometry);

      normalsArr.delete();
      pc.delete();
      loc.delete();
      tri.delete();
      face.delete();
      faceHandle.delete();
    }
    exp.delete();
  });

  return geometries;
}