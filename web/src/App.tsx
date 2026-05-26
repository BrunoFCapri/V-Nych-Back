import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useAPI } from './utils/useAPI';
import Login from './pages/Login';
import Register from './pages/Register';
import Notes from './pages/Notes';
import Calendar from './pages/Calendar';
import Tasks from './pages/Tasks';
import AdminDashboard from './pages/AdminDashboard.tsx';
import DriveAllFiles from './pages/DriveAllFiles';
import DriveByTask from './pages/DriveByTask';
import { calendarIcon, folderIcon, starIcon, taskIcon } from './assets/icons';
import beetleTorso from './assets/logo/beetle/torso.svg';
import beetleShellLeft from './assets/logo/beetle/shell-left.svg?url';
import beetleShellRight from './assets/logo/beetle/shell-right.svg?url';
import beetleWingLeft from './assets/logo/beetle/wing-left.svg';
import beetleWingRight from './assets/logo/beetle/wing-right.svg';
import './App.css';

interface Status {
  status: string;
  database: string;
  redis: string;
}

interface ServiceNode {
  key: string;
  label: string;
  value: string;
  connected: boolean;
}

export function FluidCubeScene() {
  const canvasHostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = canvasHostRef.current;

    if (!host) {
      return undefined;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(2.8, 2.1, 4.2);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);

    let rotationX = 0.32;
    let rotationY = 0.72;
    let angularVelocityX = 0;
    let angularVelocityY = 0;
    const autoAngularVelocityX = 0.0012;
    const autoAngularVelocityY = 0.0022;
    let isDragging = false;
    let previousPointerX = 0;
    let previousPointerY = 0;

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    ambientLight.layers.enable(1);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(4, 6, 5);
    keyLight.layers.enable(1);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x84ff6d, 0.9);
    fillLight.position.set(-4, 1, -3);
    fillLight.layers.enable(1);
    scene.add(fillLight);

    const fluidLight = new THREE.PointLight(0x8cff42, 1.8, 8, 2);
    fluidLight.position.set(0, 0, 0);
    scene.add(fluidLight);

    const containerSize = 2.45;
    const containerGroup = new THREE.Group();
    const containerBody = new THREE.Mesh(
      new THREE.BoxGeometry(containerSize, containerSize, containerSize),
      new THREE.MeshStandardMaterial({
        color: 0xadff23,
        transparent: true,
        opacity: 0.08,
        roughness: 0.42,
        metalness: 0.1,
        side: THREE.DoubleSide,
        emissive: 0x263b05,
        emissiveIntensity: 0.12,
      }),
    );
    containerGroup.add(containerBody);
    const containerMaterial = new THREE.MeshStandardMaterial({
      color: 0xadff23,
      roughness: 0.18,
      metalness: 0.16,
      emissive: 0x587a08,
      emissiveIntensity: 0.9,
    });
    const containerEdgeGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1, 18, 1, false);
    const containerEdgePairs = [
      [-1, -1, -1, 1, -1, -1],
      [-1, -1, -1, -1, 1, -1],
      [-1, -1, -1, -1, -1, 1],
      [1, 1, 1, -1, 1, 1],
      [1, 1, 1, 1, -1, 1],
      [1, 1, 1, 1, 1, -1],
      [-1, 1, -1, 1, 1, -1],
      [-1, 1, -1, -1, 1, 1],
      [1, -1, -1, 1, 1, -1],
      [1, -1, -1, 1, -1, 1],
      [-1, -1, 1, 1, -1, 1],
      [-1, -1, 1, -1, 1, 1],
    ];
    const containerStart = new THREE.Vector3();
    const containerEnd = new THREE.Vector3();
    const containerDirection = new THREE.Vector3();
    const containerUp = new THREE.Vector3(0, 1, 0);
    const containerHalf = containerSize * 0.5;

    containerEdgePairs.forEach(([sx, sy, sz, ex, ey, ez]) => {
      containerStart.set(sx * containerHalf, sy * containerHalf, sz * containerHalf);
      containerEnd.set(ex * containerHalf, ey * containerHalf, ez * containerHalf);
      containerDirection.subVectors(containerEnd, containerStart);

      const edge = new THREE.Mesh(containerEdgeGeometry, containerMaterial);
      edge.position.copy(containerStart).add(containerEnd).multiplyScalar(0.5);
      edge.scale.set(1, containerDirection.length(), 1);
      edge.quaternion.setFromUnitVectors(containerUp, containerDirection.clone().normalize());
      containerGroup.add(edge);
    });

    const fluidGroup = new THREE.Group();
    const dropletGeometry = new THREE.BoxGeometry(0.26, 0.26, 0.26);
    const dropletMaterial = new THREE.MeshStandardMaterial({
      color: 0x014011,
      roughness: 0.1,
      metalness: 0.03,
      transparent: false,
      opacity: 1,
      emissive: 0x012c0d,
      emissiveIntensity: 1,
    });

    const fluidRadius = 0.72;
    const dropletCount = 48;
    interface DropletMesh extends THREE.Mesh {
      userData: { velocity: THREE.Vector3; radius: number; seed: number };
    }
    const droplets: DropletMesh[] = [];
    const gravity = new THREE.Vector3(0, -0.0105, 0);
    const flowCenter = new THREE.Vector3(0, 0, 0);
    const particleRadius = 0.26;

    for (let index = 0; index < dropletCount; index += 1) {
      const droplet = new THREE.Mesh(dropletGeometry, dropletMaterial) as unknown as DropletMesh;
      const spread = fluidRadius * 0.72;
      droplet.position.set(
        (Math.random() * 2 - 1) * spread,
        (Math.random() * 2 - 1) * spread,
        (Math.random() * 2 - 1) * spread,
      );
      droplet.userData.velocity = new THREE.Vector3(
        (Math.random() * 2 - 1) * 0.012,
        (Math.random() * 2 - 1) * 0.012,
        (Math.random() * 2 - 1) * 0.012,
      );
      droplet.userData.radius = particleRadius;
      droplet.userData.seed = index * 0.61;
      fluidGroup.add(droplet);
      droplets.push(droplet);
    }

    containerGroup.add(fluidGroup);
    scene.add(containerGroup);

    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      const safeWidth = Math.max(width, 1);
      const safeHeight = Math.max(height, 1);

      renderer.setSize(safeWidth, safeHeight, false);
      camera.aspect = safeWidth / safeHeight;
      camera.updateProjectionMatrix();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    const onPointerDown = (event: PointerEvent) => {
      isDragging = true;
      previousPointerX = event.clientX;
      previousPointerY = event.clientY;
      host.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!isDragging) {
        return;
      }

      const deltaX = event.clientX - previousPointerX;
      const deltaY = event.clientY - previousPointerY;

      angularVelocityY = deltaX * 0.006;
      angularVelocityX = deltaY * 0.006;

      previousPointerX = event.clientX;
      previousPointerY = event.clientY;
    };

    const onPointerUp = (event: PointerEvent) => {
      isDragging = false;
      if (host.hasPointerCapture(event.pointerId)) {
        host.releasePointerCapture(event.pointerId);
      }
    };

    host.addEventListener('pointerdown', onPointerDown);
    host.addEventListener('pointermove', onPointerMove);
    host.addEventListener('pointerup', onPointerUp);
    host.addEventListener('pointerleave', onPointerUp);

    let frameId = 0;
    const tempDirection = new THREE.Vector3();
    const tempOffset = new THREE.Vector3();
    const tempAcceleration = new THREE.Vector3();
    const tempLocalGravity = new THREE.Vector3();
    const tempInverseQuaternion = new THREE.Quaternion();
    const tempSeparation = new THREE.Vector3();

    const animate = () => {
      const time = performance.now() * 0.001;
      const innerBound = containerSize * 0.5 - particleRadius;

      tempInverseQuaternion.copy(containerGroup.quaternion).invert();
      tempLocalGravity.copy(gravity).applyQuaternion(tempInverseQuaternion);

      droplets.forEach((droplet, index) => {
        const velocity = droplet.userData.velocity;

        tempDirection
          .set(
            Math.sin(time * 1.4 + index * 0.5),
            Math.cos(time * 1.1 + index * 0.7),
            Math.sin(time * 1.8 + index * 0.3),
          )
          .multiplyScalar(0.0009);

        tempOffset.copy(flowCenter).sub(droplet.position).multiplyScalar(0.0014);
        tempAcceleration.copy(tempDirection).add(tempOffset).add(tempLocalGravity);
        velocity.add(tempAcceleration);
        velocity.multiplyScalar(0.985);
        droplet.position.add(velocity);

        (['x', 'y', 'z'] as const).forEach((axis) => {
          if (axis === 'x') {
            if (Math.abs(droplet.position.x) > innerBound) {
              droplet.position.x = Math.sign(droplet.position.x) * innerBound;
              velocity.x *= -0.8;
            }
            return;
          }

          if (axis === 'y') {
            if (Math.abs(droplet.position.y) > innerBound) {
              droplet.position.y = Math.sign(droplet.position.y) * innerBound;
              velocity.y *= -0.62;
            }
            return;
          }

          if (Math.abs(droplet.position.z) > innerBound) {
            droplet.position.z = Math.sign(droplet.position.z) * innerBound;
            velocity.z *= -0.8;
          }
        });

        droplet.scale.setScalar(1.55 + Math.sin(time * 3.2 + index) * 0.12);
      });

      for (let leftIndex = 0; leftIndex < droplets.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < droplets.length; rightIndex += 1) {
          const leftDroplet = droplets[leftIndex];
          const rightDroplet = droplets[rightIndex];
          const minDistance = leftDroplet.userData.radius + rightDroplet.userData.radius;

          tempSeparation.subVectors(rightDroplet.position, leftDroplet.position);
          const distance = tempSeparation.length();

          if (distance === 0 || distance >= minDistance) {
            continue;
          }

          const overlap = minDistance - distance;
          tempSeparation.normalize();

          leftDroplet.position.addScaledVector(tempSeparation, -overlap * 0.5);
          rightDroplet.position.addScaledVector(tempSeparation, overlap * 0.5);

          const relativeVelocity = rightDroplet.userData.velocity.clone().sub(leftDroplet.userData.velocity);
          const velocityAlongNormal = relativeVelocity.dot(tempSeparation);

          if (velocityAlongNormal > 0) {
            continue;
          }

          const restitution = 0.72;
          const impulse = -(1 + restitution) * velocityAlongNormal * 0.5;
          leftDroplet.userData.velocity.addScaledVector(tempSeparation, -impulse);
          rightDroplet.userData.velocity.addScaledVector(tempSeparation, impulse);
        }
      }

      fluidLight.intensity = 2.0 + Math.sin(time * 1.8) * 0.35;

      if (!isDragging) {
        angularVelocityX += (autoAngularVelocityX - angularVelocityX) * 0.02;
        angularVelocityY += (autoAngularVelocityY - angularVelocityY) * 0.02;
      }

      rotationX += angularVelocityX;
      rotationY += angularVelocityY;

      angularVelocityX *= isDragging ? 0.94 : 0.985;
      angularVelocityY *= isDragging ? 0.94 : 0.985;

      containerGroup.rotation.x = rotationX;
      containerGroup.rotation.y = rotationY;
      containerGroup.rotation.z = 0;

      containerGroup.position.y = Math.sin(time * 0.9) * 0.01;

      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      host.removeEventListener('pointerdown', onPointerDown);
      host.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('pointerup', onPointerUp);
      host.removeEventListener('pointerleave', onPointerUp);
      containerEdgeGeometry.dispose();
      containerMaterial.dispose();
      containerBody.geometry.dispose();
      containerBody.material.dispose();
      dropletGeometry.dispose();
      dropletMaterial.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div className="fluid-cube-mini__canvas" ref={canvasHostRef} aria-label="Fluido contenido dentro de un cubo verde" />;
}

interface ServiceClusterSceneProps {
  services: ServiceNode[];
}

function ServiceClusterScene({ services }: ServiceClusterSceneProps) {
  const backCanvasHostRef = useRef<HTMLDivElement | null>(null);
  const frontCanvasHostRef = useRef<HTMLDivElement | null>(null);
  const servicesRef = useRef(services);

  useEffect(() => {
    servicesRef.current = services;
  }, [services]);

  useEffect(() => {
    const backHost = backCanvasHostRef.current;
    const frontHost = frontCanvasHostRef.current;

    if (!backHost || !frontHost) {
      return undefined;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 1.2, 7.2);
    camera.lookAt(0, 0.1, 0);

    const backRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    backRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    backRenderer.setClearColor(0x000000, 0);
    backHost.appendChild(backRenderer.domElement);

    const frontRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    frontRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    frontRenderer.setClearColor(0x000000, 0);
    frontHost.appendChild(frontRenderer.domElement);

    let rotationX = 0.25;
    let rotationY = 0.68;
    let angularVelocityX = 0;
    let angularVelocityY = 0;
    const autoAngularVelocityX = 0.001;
    const autoAngularVelocityY = 0.0018;
    let isDragging = false;
    let previousPointerX = 0;
    let previousPointerY = 0;

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(4, 6, 5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x84ff6d, 0.9);
    fillLight.position.set(-4, 1, -3);
    scene.add(fillLight);

    const root = new THREE.Group();
    root.position.x = -1; // Desplaza la animación a la izquierda
    scene.add(root);

    const centerPoint = new THREE.Vector3(0, 0.2, 0);

    const trianglePositions = [
      new THREE.Vector3(0, 1.35, 0),
      new THREE.Vector3(-1.45, -0.85, 0),
      new THREE.Vector3(1.45, -0.85, 0),
    ];

    // Restaurar el punto de conexión central animado
    const centerConnectionPoint = centerPoint.clone();

    const connectionPoints = trianglePositions.map((point) => point.clone());
    const connectionVertexVelocities = trianglePositions.map(() => new THREE.Vector3());
    const centerConnectionVelocity = new THREE.Vector3();
    const cubePositionVelocities = trianglePositions.map(() => new THREE.Vector3());
    const tempSpringForce = new THREE.Vector3();
    const tempCubeTarget = new THREE.Vector3();
    const tempConnectionOffset = new THREE.Vector3();

    const thickEdgeGeometry = new THREE.CylinderGeometry(0.085, 0.085, 1, 16, 1, false);
    const edgeUp = new THREE.Vector3(0, 1, 0);
    const edgeDirection = new THREE.Vector3();
    const updateSegmentMesh = (mesh: THREE.Mesh, start: THREE.Vector3, end: THREE.Vector3) => {
      edgeDirection.subVectors(end, start);
      mesh.position.copy(start).add(end).multiplyScalar(0.5);
      mesh.scale.set(1, edgeDirection.length(), 1);
      mesh.quaternion.setFromUnitVectors(edgeUp, edgeDirection.clone().normalize());
    };

    const triangleEdgeMaterial = new THREE.MeshStandardMaterial({
      color: 0xadff23,
      emissive: 0x587a08,
      emissiveIntensity: 0.7,
      roughness: 0.25,
      metalness: 0.2,
      transparent: true,
      opacity: 0,
    });
    const triangleEdgePairs = [
      [0, 1],
      [1, 2],
      [2, 0],
    ] as const;
    const triangleEdgeMeshes = triangleEdgePairs.map(([leftIndex, rightIndex]) => {
      const segment = new THREE.Mesh(thickEdgeGeometry, triangleEdgeMaterial);
      updateSegmentMesh(segment, trianglePositions[leftIndex], trianglePositions[rightIndex]);
      root.add(segment);
      return segment;
    });

    const linkEdgeMaterial = new THREE.MeshStandardMaterial({
      color: 0xadff23,
      emissive: 0x587a08,
      emissiveIntensity: 0.9,
      roughness: 0.22,
      metalness: 0.24,
      transparent: true,
      opacity: 0,
    });
    const linkEdgeMeshes = trianglePositions.map((point) => {
      const segment = new THREE.Mesh(thickEdgeGeometry, linkEdgeMaterial);
      updateSegmentMesh(segment, point, centerPoint);
      root.add(segment);
      return segment;
    });

    const cubeConfigs = [
      { key: 'backend', label: 'Backend Core', position: trianglePositions[0].clone(), baseColor: 0xadff23 },
      { key: 'database', label: 'PostgreSQL', position: trianglePositions[1].clone(), baseColor: 0x8cff42 },
      { key: 'redis', label: 'Redis Cache', position: trianglePositions[2].clone(), baseColor: 0x5fe8a8 },
    ];

    interface CubeState {
      config: (typeof cubeConfigs)[number];
      group: THREE.Group;
      body: THREE.Mesh;
      bodyMaterial: THREE.MeshStandardMaterial;
      edgeMaterial: THREE.MeshStandardMaterial;
      edgeMeshes: THREE.Mesh[];
      light: THREE.PointLight;
      baseColor: number;
    }

    const cubeGeometry = new THREE.BoxGeometry(0.32, 0.32, 0.32);
    const cubeEdgeGeometry = new THREE.CylinderGeometry(0.035, 0.035, 1, 14, 1, false);
    const cubeEdgePairs = [
      [-1, -1, -1, 1, -1, -1],
      [-1, -1, 1, 1, -1, 1],
      [-1, 1, -1, 1, 1, -1],
      [-1, 1, 1, 1, 1, 1],
      [-1, -1, -1, -1, 1, -1],
      [1, -1, -1, 1, 1, -1],
      [-1, -1, 1, -1, 1, 1],
      [1, -1, 1, 1, 1, 1],
      [-1, -1, -1, -1, -1, 1],
      [1, -1, -1, 1, -1, 1],
      [-1, 1, -1, -1, 1, 1],
      [1, 1, -1, 1, 1, 1],
    ] as const;

    const cubeStates: CubeState[] = cubeConfigs.map((config) => {
      const group = new THREE.Group();
      group.position.copy(config.position);
      group.layers.set(0);
      root.add(group);

      const bodyMaterial = new THREE.MeshStandardMaterial({
        color: config.baseColor,
        transparent: true,
        opacity: 0.08,
        roughness: 0.42,
        metalness: 0.1,
        side: THREE.DoubleSide,
        emissive: 0x263b05,
        emissiveIntensity: 0.14,
      });
      const body = new THREE.Mesh(cubeGeometry, bodyMaterial);
      group.add(body);

      const edgeMaterial = new THREE.MeshStandardMaterial({
        color: 0xe7ffd0,
        emissive: 0x587a08,
        emissiveIntensity: 0.8,
        roughness: 0.2,
        metalness: 0.2,
        transparent: true,
        opacity: 0.85,
      });
      const cubeHalf = 0.15;
      const edgeMeshes = cubeEdgePairs.map(([x1, y1, z1, x2, y2, z2]) => {
        const edge = new THREE.Mesh(cubeEdgeGeometry, edgeMaterial);
        const start = new THREE.Vector3(x1 * cubeHalf, y1 * cubeHalf, z1 * cubeHalf);
        const end = new THREE.Vector3(x2 * cubeHalf, y2 * cubeHalf, z2 * cubeHalf);
        updateSegmentMesh(edge, start, end);
        group.add(edge);
        return edge;
      });

      const light = new THREE.PointLight(config.baseColor, 1.6, 6, 2);
      light.position.set(0, 0, 0);
      light.layers.enable(1);
      group.add(light);

      return {
        config,
        group,
        body,
        bodyMaterial,
        edgeMaterial,
        edgeMeshes,
        light,
        baseColor: config.baseColor,
      };
          <>
            <Route
              path="/drive/files"
              element={
                <ProtectedRoute>
                  <DriveAllFiles />
                </ProtectedRoute>
              }
            />
            <Route
              path="/drive/tasks"
              element={
                <ProtectedRoute>
                  <DriveByTask />
                </ProtectedRoute>
              }
            />
          </>
    });

    const resize = () => {
      const { width, height } = frontHost.getBoundingClientRect();
      const safeWidth = Math.max(width, 1);
      const safeHeight = Math.max(height, 1);

      backRenderer.setSize(safeWidth, safeHeight, false);
      frontRenderer.setSize(safeWidth, safeHeight, false);
      camera.aspect = safeWidth / safeHeight;
      camera.updateProjectionMatrix();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(frontHost);
    resize();

    const onPointerDown = (event: PointerEvent) => {
      isDragging = true;
      previousPointerX = event.clientX;
      previousPointerY = event.clientY;
      frontHost.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!isDragging) {
        return;
      }

      const deltaX = event.clientX - previousPointerX;
      const deltaY = event.clientY - previousPointerY;

      angularVelocityY = deltaX * 0.006;
      angularVelocityX = deltaY * 0.006;

      previousPointerX = event.clientX;
      previousPointerY = event.clientY;
    };

    const onPointerUp = (event: PointerEvent) => {
      isDragging = false;
      if (frontHost.hasPointerCapture(event.pointerId)) {
        frontHost.releasePointerCapture(event.pointerId);
      }
    };

    frontHost.addEventListener('pointerdown', onPointerDown);
    frontHost.addEventListener('pointermove', onPointerMove);
    frontHost.addEventListener('pointerup', onPointerUp);
    frontHost.addEventListener('pointerleave', onPointerUp);

    let frameId = 0;
    const tempWorldPosition = new THREE.Vector3();
    const tempCameraPosition = new THREE.Vector3();
    const smoothedDepths = cubeStates.map(() => 0);
    let activeFrontCubeIndex = 0;
    let candidateFrontCubeIndex = 0;
    let frontTransition = 1;
    const frontSwitchThreshold = 0.07;
    const frontTransitionSpeed = 0.11;

    const animate = () => {
      const time = performance.now() * 0.001;
      const currentServices = servicesRef.current;
      const allConnected = currentServices.every((serviceItem) => serviceItem.connected);

      cubeStates.forEach((cubeState, cubeIndex) => {
        const connected = currentServices[cubeIndex]?.connected ?? true;
        const pulse = connected ? 1.03 + Math.sin(time * 2.6 + cubeIndex) * 0.04 : 0.94 + Math.sin(time * 2.2 + cubeIndex) * 0.03;

        cubeState.group.rotation.x = time * (0.28 + cubeIndex * 0.04) + cubeIndex * 0.18;
        cubeState.group.rotation.y = time * (0.42 + cubeIndex * 0.03) + cubeIndex * 0.24;
        cubeState.group.scale.setScalar(pulse);

        cubeState.bodyMaterial.color.setHex(connected ? cubeState.baseColor : 0xf27b35);
        cubeState.bodyMaterial.emissive.setHex(connected ? 0x263b05 : 0x341006);
        cubeState.bodyMaterial.opacity = connected ? 0.08 : 0.1;
        cubeState.edgeMaterial.color.setHex(connected ? 0xe7ffd0 : 0xffc7a6);
        cubeState.edgeMaterial.emissive.setHex(connected ? 0x587a08 : 0x5c2206);
        cubeState.edgeMaterial.emissiveIntensity = connected ? 0.9 : 0.7;
        cubeState.light.color.setHex(connected ? cubeState.baseColor : 0xf27b35);
        cubeState.light.intensity = (connected ? 1.6 : 1.2) + Math.sin(time * 1.8 + cubeIndex) * 0.25;
        cubeState.edgeMeshes.forEach((edgeMesh, edgeIndex) => {
          edgeMesh.scale.x = 1.03 + Math.sin(time * 2.4 + cubeIndex + edgeIndex * 0.17) * 0.05;
          edgeMesh.scale.z = 1.03 + Math.sin(time * 2.2 + cubeIndex + edgeIndex * 0.21) * 0.05;
        });
      });

      triangleEdgeMaterial.color.setHex(allConnected ? 0xe7ffd0 : 0xffc7a6);
      triangleEdgeMaterial.emissive.setHex(allConnected ? 0x587a08 : 0x5c2206);
      triangleEdgeMaterial.opacity = 0;
      linkEdgeMaterial.color.setHex(allConnected ? 0xadff23 : 0xf27b35);
      linkEdgeMaterial.emissive.setHex(allConnected ? 0x587a08 : 0x5c2206);
      linkEdgeMaterial.opacity = 0;
      triangleEdgeMeshes.forEach((edgeMesh, edgeIndex) => {
        edgeMesh.scale.x = 1.04 + Math.sin(time * 2.2 + edgeIndex * 0.35) * 0.07;
        edgeMesh.scale.z = 1.04 + Math.sin(time * 2.3 + edgeIndex * 0.4) * 0.07;
      });
      linkEdgeMeshes.forEach((edgeMesh, edgeIndex) => {
        edgeMesh.scale.x = 1.08 + Math.sin(time * 2.5 + edgeIndex * 0.4) * 0.08;
        edgeMesh.scale.z = 1.08 + Math.sin(time * 2.6 + edgeIndex * 0.45) * 0.08;
      });

      const rotationEnergy = Math.min(2.2, (Math.abs(angularVelocityX) + Math.abs(angularVelocityY)) * 150);
      tempSpringForce
        .set(
          centerPoint.x + Math.sin(time * 4.6) * (0.03 + rotationEnergy * 0.05),
          centerPoint.y + Math.cos(time * 4.2) * (0.03 + rotationEnergy * 0.05),
          centerPoint.z + Math.sin(time * 5) * (0.03 + rotationEnergy * 0.05),
        )
        .sub(centerConnectionPoint)
        .multiplyScalar(0.26);
      centerConnectionVelocity.add(tempSpringForce);
      centerConnectionVelocity.multiplyScalar(0.84);
      centerConnectionPoint.add(centerConnectionVelocity);

      connectionPoints.forEach((nodePoint, index) => {
        const target = trianglePositions[index];
        const wobbleAmplitude = 0.05 + rotationEnergy * 0.11;

        tempSpringForce
          .set(
            target.x + Math.sin(time * 4.1 + index * 1.7) * wobbleAmplitude,
            target.y + Math.cos(time * 3.8 + index * 1.3) * wobbleAmplitude * 0.9,
            target.z + Math.sin(time * 4.4 + index * 1.1) * wobbleAmplitude,
          )
          .sub(nodePoint)
          .multiplyScalar(0.22);

        connectionVertexVelocities[index].add(tempSpringForce);
        connectionVertexVelocities[index].multiplyScalar(0.86);
        nodePoint.add(connectionVertexVelocities[index]);
      });

      triangleEdgePairs.forEach(([leftIndex, rightIndex], edgeIndex) => {
        updateSegmentMesh(triangleEdgeMeshes[edgeIndex], connectionPoints[leftIndex], connectionPoints[rightIndex]);
      });
      linkEdgeMeshes.forEach((edgeMesh, edgeIndex) => {
        updateSegmentMesh(edgeMesh, connectionPoints[edgeIndex], centerConnectionPoint);
      });

      cubeStates.forEach((cubeState, cubeIndex) => {
        const targetPosition = trianglePositions[cubeIndex];
        const bobY = Math.sin(time * 1.4 + cubeIndex) * 0.08;
        tempConnectionOffset.copy(connectionPoints[cubeIndex]).sub(targetPosition);
        tempCubeTarget.copy(cubeState.config.position).addScaledVector(tempConnectionOffset, 0.58);
        tempCubeTarget.y += bobY;

        tempSpringForce.copy(tempCubeTarget).sub(cubeState.group.position).multiplyScalar(0.2);
        cubePositionVelocities[cubeIndex].add(tempSpringForce);
        cubePositionVelocities[cubeIndex].multiplyScalar(0.82);
        cubeState.group.position.add(cubePositionVelocities[cubeIndex]);
      });

      if (!isDragging) {
        angularVelocityX += (autoAngularVelocityX - angularVelocityX) * 0.02;
        angularVelocityY += (autoAngularVelocityY - angularVelocityY) * 0.02;
      }

      rotationX += angularVelocityX;
      rotationY += angularVelocityY;

      angularVelocityX *= isDragging ? 0.94 : 0.985;
      angularVelocityY *= isDragging ? 0.94 : 0.985;

      root.rotation.x = rotationX;
      root.rotation.y = rotationY;
      root.rotation.z = 0;
      root.position.y = Math.sin(time * 0.8) * 0.02;

      let bestDepth = -Infinity;
      let bestCubeIndex = activeFrontCubeIndex;
      cubeStates.forEach((cubeState, index) => {
        cubeState.group.getWorldPosition(tempWorldPosition);
        tempCameraPosition.copy(tempWorldPosition).applyMatrix4(camera.matrixWorldInverse);
        smoothedDepths[index] = smoothedDepths[index] * 0.84 + tempCameraPosition.z * 0.16;
        if (smoothedDepths[index] > bestDepth) {
          bestDepth = smoothedDepths[index];
          bestCubeIndex = index;
        }
      });

      const activeDepth = smoothedDepths[activeFrontCubeIndex];
      if (
        bestCubeIndex !== activeFrontCubeIndex
        && smoothedDepths[bestCubeIndex] > activeDepth + frontSwitchThreshold
      ) {
        if (candidateFrontCubeIndex !== bestCubeIndex) {
          candidateFrontCubeIndex = bestCubeIndex;
          frontTransition = 0;
        }
      }

      if (candidateFrontCubeIndex !== activeFrontCubeIndex) {
        frontTransition = Math.min(1, frontTransition + frontTransitionSpeed);
        if (frontTransition >= 0.72) {
          activeFrontCubeIndex = candidateFrontCubeIndex;
        }
        if (frontTransition >= 1) {
          candidateFrontCubeIndex = activeFrontCubeIndex;
        }
      }

      cubeStates.forEach((cubeState, index) => {
        const isActiveFront = index === activeFrontCubeIndex;
        const isCandidateFront = index === candidateFrontCubeIndex && candidateFrontCubeIndex !== activeFrontCubeIndex;
        const layer = isActiveFront || isCandidateFront ? 1 : 0;
        cubeState.group.traverse((object) => {
          object.layers.set(layer);
        });
      });

      cubeStates.forEach((cubeState, index) => {
        const connected = currentServices[index]?.connected ?? true;
        const isFront = index === activeFrontCubeIndex || (index === candidateFrontCubeIndex && candidateFrontCubeIndex !== activeFrontCubeIndex);

        if (connected) {
          cubeState.bodyMaterial.color.setHex(cubeState.baseColor);
          cubeState.edgeMaterial.color.setHex(0xe7ffd0);
        } else {
          cubeState.bodyMaterial.color.setHex(0xf27b35);
          cubeState.edgeMaterial.color.setHex(0xffc7a6);
        }

        if (!isFront) {
          cubeState.bodyMaterial.color.offsetHSL(0, -0.2, -0.24);
          cubeState.edgeMaterial.color.offsetHSL(0, -0.16, -0.2);
        }

        cubeState.bodyMaterial.opacity = isFront ? (connected ? 0.08 : 0.1) : (connected ? 0.055 : 0.07);
        cubeState.bodyMaterial.emissiveIntensity = isFront ? 0.14 : 0.055;
        cubeState.edgeMaterial.opacity = isFront ? 0.85 : 0.52;
        cubeState.edgeMaterial.emissiveIntensity = isFront ? 0.9 : 0.4;
        cubeState.light.intensity *= isFront ? 1 : 0.5;
      });

      camera.layers.set(0);
      backRenderer.render(scene, camera);
      camera.layers.set(1);
      frontRenderer.render(scene, camera);
      camera.layers.enableAll();

      frameId = window.requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      frontHost.removeEventListener('pointerdown', onPointerDown);
      frontHost.removeEventListener('pointermove', onPointerMove);
      frontHost.removeEventListener('pointerup', onPointerUp);
      frontHost.removeEventListener('pointerleave', onPointerUp);

      cubeStates.forEach((cubeState) => {
        cubeState.bodyMaterial.dispose();
        cubeState.edgeMaterial.dispose();
      });

      cubeGeometry.dispose();
      cubeEdgeGeometry.dispose();
      thickEdgeGeometry.dispose();
      triangleEdgeMaterial.dispose();
      linkEdgeMaterial.dispose();
      backRenderer.dispose();
      frontRenderer.dispose();
      if (backRenderer.domElement.parentNode === backHost) {
        backHost.removeChild(backRenderer.domElement);
      }
      if (frontRenderer.domElement.parentNode === frontHost) {
        frontHost.removeChild(frontRenderer.domElement);
      }
    };
  }, []);

  return (
    <>
      <div className="cluster-cube-scene__canvas cluster-cube-scene__canvas--back" ref={backCanvasHostRef} aria-hidden="true" />
      <div className="cluster-cube-scene__canvas cluster-cube-scene__canvas--front" ref={frontCanvasHostRef} aria-label="Tres cubos conectados" />
    </>
  );
}

function Dashboard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [beetleState, setBeetleState] = useState<'idle' | 'online' | 'offline'>('idle');
  const [beetleAnimationKey, setBeetleAnimationKey] = useState(0);
  const [beetleSubtle, setBeetleSubtle] = useState(false);
  const hasBeenOnline = useRef(false);
  const wasConnectedRef = useRef(false);
  const subtleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { logout, user } = useAuth();
  const { fetchAPI } = useAPI();
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    let firstCheck = true;

    const checkStatus = async () => {
      try {
        const res = await fetchAPI(`/api/status`, { skipAuth: true });
        const data: Status = await res.json();
        if (!isMounted) return;

        setStatus(data);
      } catch (err) {
        console.error(err);
        if (!isMounted) return;

        setStatus(null);
      } finally {
        if (isMounted && firstCheck) {
          setLoading(false);
          firstCheck = false;
        }
      }
    };

    checkStatus();
    const intervalId = setInterval(checkStatus, 2000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  const normalize = (value: string | undefined) => (value ?? '').trim().toLowerCase();
  const isConnectedValue = (value: string | undefined) => {
    const normalized = normalize(value);
    return normalized === 'connected' || normalized === 'ok' || normalized === 'running';
  };

  const allServicesConnected =
    status !== null &&
    isConnectedValue(status.status) &&
    isConnectedValue(status.database) &&
    isConnectedValue(status.redis);

  const services: ServiceNode[] = [
    {
      key: 'backend',
      label: 'Backend Core',
      value: status ? status.status : loading ? 'Verificando...' : 'Desconectado',
      connected: status !== null && isConnectedValue(status.status),
    },
    {
      key: 'database',
      label: 'PostgreSQL',
      value: status ? status.database : loading ? 'Verificando...' : 'Desconectado',
      connected: status !== null && isConnectedValue(status.database),
    },
    {
      key: 'redis',
      label: 'Redis Cache',
      value: status ? status.redis : loading ? 'Verificando...' : 'Desconectado',
      connected: status !== null && isConnectedValue(status.redis),
    },
  ];

  useEffect(() => {
    const wasConnected = wasConnectedRef.current;

    if (subtleTimerRef.current) {
      clearTimeout(subtleTimerRef.current);
      subtleTimerRef.current = null;
    }

    if (allServicesConnected && !wasConnected) {
      hasBeenOnline.current = true;
      setBeetleSubtle(false);
      setBeetleState('online');
      setBeetleAnimationKey((prev) => prev + 1);
      subtleTimerRef.current = setTimeout(() => {
        setBeetleSubtle(true);
      }, 2500);
    } else if (!allServicesConnected && wasConnected && hasBeenOnline.current) {
      setBeetleSubtle(false);
      setBeetleState('offline');
      setBeetleAnimationKey((prev) => prev + 1);
    }

    wasConnectedRef.current = allServicesConnected;
  }, [allServicesConnected]);

  useEffect(() => {
    return () => {
      if (subtleTimerRef.current) {
        clearTimeout(subtleTimerRef.current);
      }
    };
  }, []);

  const beetleStateClass =
    beetleState === 'online' ? 'beetle-offline' : beetleState === 'offline' ? 'beetle-online' : '';
  const beetleSubtleClass = beetleSubtle ? 'beetle-subtle' : '';

  return (
    <div className="container">
      <header className="header">
        <div className="header__copy">
          <p className="eyebrow header__eyebrow">Workspace</p>
          <h1>V-NYCH</h1>
          <p className="subtitle header__subtitle">Private, Secure, Self-Hosted</p>
        </div>
        <div className="user-info header__user-info">
          <span>Hola, {user?.username}</span>
          <button onClick={logout} className="logout-btn">Salir</button>
        </div>
      </header>
      
      <main className="dashboard">
        <section className="card fluid-mini">
          <div className="fluid-mini__header">
            <p className="eyebrow">Servidores</p>
          </div>
          <div className="fluid-mini__scene">
            <ServiceClusterScene services={services} />
            <div className="fluid-mini__beetle-overlay" aria-hidden="true">
              <div key={beetleAnimationKey} className={`beetle-logo ${beetleStateClass} ${beetleSubtleClass}`}>
                <img className="beetle-wing beetle-wing-left" src={beetleWingLeft} alt="" />
                <img className="beetle-wing beetle-wing-right" src={beetleWingRight} alt="" />
                <img className="beetle-part beetle-torso" src={beetleTorso} alt="" />
                <img className="beetle-part beetle-shell-left" src={beetleShellLeft} alt="" />
                <img className="beetle-part beetle-shell-right" src={beetleShellRight} alt="" />
              </div>
            </div>
          </div>
          {status && (
            <div className="status-grid">
              <div className="status-item ok">
                <span className="label">Backend Core</span>
                <span className="value">Running</span>
              </div>
              <div className={`status-item ${status.database === "Connected" ? 'ok' : 'error'}`}>
                <span className="label">PostgreSQL</span>
                <span className="value">{status.database}</span>
              </div>
              <div className={`status-item ${status.redis === "Connected" ? 'ok' : 'error'}`}>
                <span className="label">Redis Cache</span>
                <span className="value">{status.redis}</span>
              </div>
            </div>
          )}
        </section>

        <section className="card quick-actions-card">
          <div className="actions">
            <button className="action-btn" onClick={() => navigate('/notes')}>
              <img src={folderIcon} alt="Notes icon" />
              <span>Notes</span>
            </button>
            <button className="action-btn" onClick={() => navigate('/calendar')}>
              <img src={calendarIcon} alt="Calendar icon" />
              <span>Calendar</span>
            </button>
            <button className="action-btn" onClick={() => navigate('/tasks')}>
              <img src={taskIcon} alt="Tasks icon" />
              <span>Tasks</span>
            </button>
            <button className="action-btn" onClick={() => navigate('/drive/files')}>
              <img src={starIcon} alt="Drive icon" />
              <span>Drive</span>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" />;
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return user?.is_admin ? children : <Navigate to="/" />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />
        <Route
          path="/notes"
          element={
            <ProtectedRoute>
              <Notes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/calendar"
          element={
            <ProtectedRoute>
              <Calendar />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tasks"
          element={
            <ProtectedRoute>
              <Tasks />
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/drive/files"
          element={
            <ProtectedRoute>
              <DriveAllFiles />
            </ProtectedRoute>
          }
        />
        <Route
          path="/drive/tasks"
          element={
            <ProtectedRoute>
              <DriveByTask />
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
