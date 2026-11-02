/* src/components/CropPhoto.tsx */
import React, { useEffect, useRef, useState } from 'react';
import { useUiLang, useThemeAssets, ProgressBar } from '../communs';
import ZoomBar from './ZoomBar';

interface CropPhotoProps {
    imageSrc: string;
    onCancel: () => void;
    onConfirm: (croppedDataUrl: string) => void;
}

// Format de sortie du recadrage : portrait 9:16 (format téléphone).
const RATIO_LARGEUR = 9;
const RATIO_HAUTEUR = 16;
const SORTIE_LARGEUR = 720;
const SORTIE_HAUTEUR = Math.round((SORTIE_LARGEUR * RATIO_HAUTEUR) / RATIO_LARGEUR);

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

interface Pan {
    x: number;
    y: number;
}

const CropPhoto: React.FC<CropPhotoProps> = ({ imageSrc, onCancel, onConfirm }) => {
    const t = useUiLang();
    const assets = useThemeAssets();
    const imgRef = useRef<HTMLImageElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);
    const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
    const [zoom, setZoom] = useState(MIN_ZOOM);
    const [pan, setPan] = useState<Pan>({ x: 0, y: 0 });
    const dragRef = useRef<{ startX: number; startY: number; panStart: Pan } | null>(null);
    const [enregistrement, setEnregistrement] = useState(false);
    const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 });

    // baseScale = échelle à zoom=1 pour que l'image couvre tout le cadre 9:16
    // (comme background-size: cover), quelle que soit son orientation d'origine.
    const getViewportSize = () => {
        const el = viewportRef.current;
        if (!el) return { w: 0, h: 0 };
        const rect = el.getBoundingClientRect();
        return { w: rect.width, h: rect.height };
    };

    // Tient viewportSize à jour pour le rendu (scaleActuelle), sans lire la
    // ref directement pendant le rendu.
    useEffect(() => {
        const el = viewportRef.current;
        if (!el) return;
        const update = () => setViewportSize(getViewportSize());
        update();
        const observer = new ResizeObserver(update);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const clampPan = (candidate: Pan, currentZoom: number): Pan => {
        if (!naturalSize) return candidate;
        const { w: vw, h: vh } = getViewportSize();
        const baseScale = Math.max(vw / naturalSize.w, vh / naturalSize.h);
        const scale = baseScale * currentZoom;
        const dispW = naturalSize.w * scale;
        const dispH = naturalSize.h * scale;
        const minX = Math.min(0, vw - dispW);
        const minY = Math.min(0, vh - dispH);
        return {
            x: Math.min(0, Math.max(candidate.x, minX)),
            y: Math.min(0, Math.max(candidate.y, minY)),
        };
    };

    const handleImageLoad = () => {
        const img = imgRef.current;
        if (!img) return;
        setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
        setZoom(MIN_ZOOM);
        setPan({ x: 0, y: 0 });
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        dragRef.current = { startX: e.clientX, startY: e.clientY, panStart: pan };
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragRef.current) return;
        const { startX, startY, panStart } = dragRef.current;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        setPan(clampPan({ x: panStart.x + dx, y: panStart.y + dy }, zoom));
    };

    const handlePointerUp = () => {
        dragRef.current = null;
    };

    const handleZoomChange = (nouveauZoom: number) => {
        setZoom(nouveauZoom);
        setPan((p) => clampPan(p, nouveauZoom));
    };

    const handleConfirm = () => {
        const img = imgRef.current;
        if (!img || !naturalSize) return;
        setEnregistrement(true);

        // Le dessin sur canvas ci-dessous est synchrone et quasi instantané :
        // sans ce délai, React n'a jamais l'occasion de peindre l'état
        // enregistrement=true (donc la barre de progression) avant que tout
        // ne soit déjà terminé. Un requestAnimationFrame (attend la
        // prochaine peinture) suivi d'un setTimeout (laisse cette peinture
        // s'afficher réellement à l'écran) garantit que la barre est bien
        // visible un court instant plutôt que jamais.
        requestAnimationFrame(() => {
            setTimeout(() => {
                const { w: vw, h: vh } = getViewportSize();
                const baseScale = Math.max(vw / naturalSize.w, vh / naturalSize.h);
                const scale = baseScale * zoom;

                // Rectangle source (dans les pixels naturels de l'image)
                // correspondant à la zone actuellement visible dans le cadre
                // de recadrage.
                const sx = -pan.x / scale;
                const sy = -pan.y / scale;
                const sw = vw / scale;
                const sh = vh / scale;

                const canvas = document.createElement('canvas');
                canvas.width = SORTIE_LARGEUR;
                canvas.height = SORTIE_HAUTEUR;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    setEnregistrement(false);
                    return;
                }
                ctx.drawImage(img, sx, sy, sw, sh, 0, 0, SORTIE_LARGEUR, SORTIE_HAUTEUR);
                onConfirm(canvas.toDataURL('image/jpeg', 0.9));
            }, 0);
        });
    };

    const scaleActuelle = naturalSize
        ? Math.max(viewportSize.w / naturalSize.w, viewportSize.h / naturalSize.h) * zoom
        : 1;

    return (
        <div className="crop-overlay">
            <div className="create-banner-title">
                <img src={assets.titre2} alt="" className="create-banner-bg" />
                <span className="create-banner-text">{t.recadrerInstruction}</span>
            </div>

            <div className="crop-body">
                <div
                    ref={viewportRef}
                    className="crop-viewport"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                >
                    <img
                        ref={imgRef}
                        src={imageSrc}
                        alt=""
                        className="crop-image"
                        draggable={false}
                        onLoad={handleImageLoad}
                        style={
                            naturalSize
                                ? {
                                      width: naturalSize.w * scaleActuelle,
                                      height: naturalSize.h * scaleActuelle,
                                      transform: `translate(${pan.x}px, ${pan.y}px)`,
                                  }
                                : undefined
                        }
                    />
                </div>

                <ZoomBar min={MIN_ZOOM} max={MAX_ZOOM} value={zoom} onChange={handleZoomChange} />

                {enregistrement && <ProgressBar className="camera-capture-progress" />}

                <div className="crop-actions">
                    <button type="button" className="crop-btn crop-btn-cancel" onClick={onCancel} disabled={enregistrement}>
                        {t.annuler}
                    </button>
                    <button type="button" className="crop-btn crop-btn-confirm" onClick={handleConfirm} disabled={enregistrement || !naturalSize}>
                        {t.continuer}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CropPhoto;
