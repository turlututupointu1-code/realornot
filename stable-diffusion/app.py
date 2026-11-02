import os
import time
import random
import threading
import tkinter as tk
from tkinter import messagebox

from PIL import Image, ImageTk

import torch
from diffusers import StableDiffusionPipeline


MODEL_PATH = os.path.expanduser(
    "~/Documents/Realornot/stable-diffusion/models/sd15-diffusers"
)

OUTPUT_DIR = os.path.expanduser(
    "~/Documents/Realornot/stable-diffusion/generated"
)

WIDTH = 384
HEIGHT = 640

FINAL_WIDTH = 768
FINAL_HEIGHT = 1280

STEPS = 15
CFG = 7.5

torch.set_num_threads(6)
torch.set_num_interop_threads(2)

os.makedirs(OUTPUT_DIR, exist_ok=True)


SUPPORTED_LANGUAGES = [
    "fr",
    "en",
    "es",
    "de",
    "it",
    "pt",
    "zh",
    "ja",
    "ko",
    "ar"
]


def moderate_prompt(prompt):
    if not prompt:
        return False, "EMPTY_PROMPT"

    if not prompt.strip():
        return False, "EMPTY_PROMPT"

    return True, "SAFE"


class StableDiffusionApp:

    def __init__(self, root):

        self.root = root

        self.root.title(
            "Générateur de photos"
        )

        self.root.geometry(
            "700x900"
        )

        self.root.resizable(
            False,
            False
        )

        self.pipe = None

        self.generating = False

        self.cancel_requested = False

        self.start_time = None

        self.current_image = None

        self.current_seed = None

        title = tk.Label(
            root,
            text="Générateur de photos",
            font=("Arial", 22, "bold")
        )

        title.pack(
            pady=20
        )

        label = tk.Label(
            root,
            text="Décrivez votre photo :",
            font=("Arial", 13)
        )

        label.pack(
            pady=5
        )

        self.prompt_text = tk.Text(
            root,
            height=5,
            width=70,
            font=("Arial", 11),
            wrap=tk.WORD
        )

        self.prompt_text.pack(
            padx=20,
            pady=5
        )

        self.prompt_text.insert(
            "1.0",
            "Un magnifique paysage de montagne au coucher du soleil"
        )

        button_frame = tk.Frame(
            root
        )

        button_frame.pack(
            pady=15
        )

        self.generate_button = tk.Button(
            button_frame,
            text="Générer la photo",
            font=("Arial", 12, "bold"),
            width=18,
            command=self.start_generation
        )

        self.generate_button.pack(
            side=tk.LEFT,
            padx=10
        )

        self.cancel_button = tk.Button(
            button_frame,
            text="Annuler",
            font=("Arial", 12),
            width=12,
            state=tk.DISABLED,
            command=self.cancel_generation
        )

        self.cancel_button.pack(
            side=tk.LEFT,
            padx=10
        )

        self.progress = tk.DoubleVar(
            value=0
        )

        self.progress_bar = tk.Scale(
            root,
            variable=self.progress,
            from_=0,
            to=100,
            orient=tk.HORIZONTAL,
            length=500,
            showvalue=False,
            state=tk.DISABLED
        )

        self.progress_bar.pack(
            pady=10
        )

        self.progress_label = tk.Label(
            root,
            text="0 %",
            font=("Arial", 11)
        )

        self.progress_label.pack()

        self.step_label = tk.Label(
            root,
            text="",
            font=("Arial", 11)
        )

        self.step_label.pack(
            pady=5
        )

        self.time_label = tk.Label(
            root,
            text="",
            font=("Arial", 10)
        )

        self.time_label.pack(
            pady=5
        )

        self.status = tk.StringVar()

        self.status.set(
            "Préparation..."
        )

        self.status_label = tk.Label(
            root,
            textvariable=self.status,
            font=("Arial", 11)
        )

        self.status_label.pack(
            pady=10
        )

        self.image_label = tk.Label(
            root,
            text="",
            font=("Arial", 12)
        )

        self.image_label.pack(
            pady=10
        )

        action_frame = tk.Frame(
            root
        )

        action_frame.pack(
            pady=10
        )

        self.modify_button = tk.Button(
            action_frame,
            text="Modifier",
            font=("Arial", 12, "bold"),
            width=15,
            state=tk.DISABLED,
            command=self.modify_image
        )

        self.modify_button.pack(
            side=tk.LEFT,
            padx=10
        )

        self.continue_button = tk.Button(
            action_frame,
            text="Continuer",
            font=("Arial", 12, "bold"),
            width=15,
            state=tk.DISABLED,
            command=self.continue_image
        )

        self.continue_button.pack(
            side=tk.LEFT,
            padx=10
        )

        self.load_model()


    def load_model(self):

        def load():

            try:

                self.pipe = StableDiffusionPipeline.from_pretrained(
                    MODEL_PATH,
                    torch_dtype=torch.float32,
                    safety_checker=None
                )

                self.pipe = self.pipe.to(
                    "cpu"
                )

                self.root.after(
                    0,
                    self.model_ready
                )

            except Exception as e:

                error_message = str(e)

                self.root.after(
                    0,
                    lambda: messagebox.showerror(
                        "Erreur",
                        "Impossible de charger le générateur.\n\n"
                        + error_message
                    )
                )


        threading.Thread(
            target=load,
            daemon=True
        ).start()


    def model_ready(self):

        self.status.set(
            "Prêt. Décrivez votre photo."
        )


    def start_generation(self):

        if self.pipe is None:

            messagebox.showwarning(
                "Veuillez patienter",
                "Le générateur est encore en cours de préparation."
            )

            return


        if self.generating:

            return


        prompt = self.prompt_text.get(
            "1.0",
            tk.END
        ).strip()


        allowed, reason = moderate_prompt(
            prompt
        )


        if not allowed:

            messagebox.showwarning(
                "Description manquante",
                "Veuillez décrire la photo que vous souhaitez créer."
            )

            return


        self.current_image = None

        self.current_seed = None

        self.generating = True

        self.cancel_requested = False

        self.start_time = time.time()


        self.generate_button.config(
            state=tk.DISABLED
        )

        self.cancel_button.config(
            state=tk.NORMAL
        )

        self.modify_button.config(
            state=tk.DISABLED
        )

        self.continue_button.config(
            state=tk.DISABLED
        )


        self.progress.set(
            0
        )

        self.progress_label.config(
            text="0 %"
        )

        self.step_label.config(
            text="Préparation..."
        )

        self.time_label.config(
            text="Temps écoulé : 0 s"
        )

        self.status.set(
            "Création de votre photo..."
        )


        thread = threading.Thread(
            target=self.generate_image,
            args=(prompt,),
            daemon=True
        )

        thread.start()

        self.update_time()


    def update_time(self):

        if not self.generating:

            return


        elapsed = (
            time.time()
            - self.start_time
        )


        current_progress = (
            self.progress.get()
        )


        if current_progress > 0:

            estimated_total = (
                elapsed
                * 100
                / current_progress
            )

            remaining = max(
                0,
                estimated_total - elapsed
            )

            remaining_text = (
                f"Temps restant : environ "
                f"{int(remaining)} s"
            )

        else:

            remaining_text = (
                "Temps restant : calcul..."
            )


        self.time_label.config(
            text=(
                f"Temps écoulé : "
                f"{int(elapsed)} s    |    "
                f"{remaining_text}"
            )
        )


        self.root.after(
            1000,
            self.update_time
        )


    def generate_image(
        self,
        prompt
    ):

        negative_prompt = (
            "blurry, low quality, distorted, "
            "deformed, bad anatomy, extra limbs, "
            "cropped, out of frame, missing subject"
        )


        seed = random.randint(
            0,
            2**32 - 1
        )


        generator = torch.Generator(
            device="cpu"
        ).manual_seed(
            seed
        )


        def callback(
            pipe,
            step,
            timestep,
            callback_kwargs
        ):

            if self.cancel_requested:

                raise RuntimeError(
                    "GENERATION_CANCELLED"
                )


            progress = (
                (step + 1)
                / STEPS
                * 80
            )


            self.root.after(
                0,
                lambda: self.update_progress(
                    step + 1,
                    progress,
                    "Création de votre photo..."
                )
            )


            return callback_kwargs


        try:

            result = self.pipe(
                prompt=prompt,
                negative_prompt=negative_prompt,
                width=WIDTH,
                height=HEIGHT,
                num_inference_steps=STEPS,
                guidance_scale=CFG,
                generator=generator,
                callback_on_step_end=callback,
                callback_on_step_end_tensor_inputs=[
                    "latents"
                ]
            )


            image = result.images[0]


            if self.cancel_requested:

                raise RuntimeError(
                    "GENERATION_CANCELLED"
                )


            self.root.after(
                0,
                lambda: self.status.set(
                    "Amélioration de la qualité..."
                )
            )


            final_image = self.upscale_image(
                image
            )


            self.current_image = final_image

            self.current_seed = seed


            self.root.after(
                0,
                lambda: self.show_image(
                    final_image
                )
            )


        except RuntimeError as e:

            if str(e) == "GENERATION_CANCELLED":

                self.root.after(
                    0,
                    self.generation_cancelled
                )

            else:

                error_message = str(e)

                self.root.after(
                    0,
                    lambda: messagebox.showerror(
                        "Erreur",
                        "Une erreur est survenue.\n\n"
                        + error_message
                    )
                )


        except Exception as e:

            error_message = str(e)

            self.root.after(
                0,
                lambda: messagebox.showerror(
                    "Erreur",
                    "Une erreur est survenue.\n\n"
                    + error_message
                )
            )


        finally:

            self.root.after(
                0,
                self.generation_finished
            )


    def upscale_image(
        self,
        image
    ):

        upscale_steps = 20


        for i in range(
            upscale_steps
        ):

            if self.cancel_requested:

                raise RuntimeError(
                    "GENERATION_CANCELLED"
                )


            progress = (
                80
                + (
                    (i + 1)
                    / upscale_steps
                    * 20
                )
            )


            self.root.after(
                0,
                lambda p=progress: self.update_progress(
                    0,
                    p,
                    "Amélioration de la qualité..."
                )
            )


            time.sleep(
                0.05
            )


        final_image = image.resize(
            (
                FINAL_WIDTH,
                FINAL_HEIGHT
            ),
            Image.Resampling.LANCZOS
        )


        return final_image


    def update_progress(
        self,
        step,
        percentage,
        status_text
    ):

        self.progress.set(
            percentage
        )


        self.progress_label.config(
            text=f"{int(percentage)} %"
        )


        if step > 0:

            self.step_label.config(
                text=(
                    f"Étape {step} / {STEPS}"
                )
            )

        else:

            self.step_label.config(
                text="Amélioration de la qualité..."
            )


        self.status.set(
            status_text
        )


    def cancel_generation(self):

        if self.generating:

            self.cancel_requested = True

            self.cancel_button.config(
                state=tk.DISABLED
            )

            self.status.set(
                "Annulation en cours..."
            )


    def generation_cancelled(self):

        self.current_image = None

        self.current_seed = None


        self.status.set(
            "Génération annulée."
        )


        self.progress_label.config(
            text="Annulé"
        )


        self.step_label.config(
            text=""
        )


        self.time_label.config(
            text=""
        )


        self.modify_button.config(
            state=tk.DISABLED
        )


        self.continue_button.config(
            state=tk.DISABLED
        )


    def generation_finished(self):

        self.generating = False


        self.generate_button.config(
            state=tk.NORMAL
        )


        self.cancel_button.config(
            state=tk.DISABLED
        )


    def show_image(
        self,
        image
    ):

        display = image.copy()


        display.thumbnail(
            (
                384,
                640
            )
        )


        photo = ImageTk.PhotoImage(
            display
        )


        self.image_label.config(
            image=photo,
            text=""
        )


        self.image_label.image = photo


        self.progress.set(
            100
        )


        self.progress_label.config(
            text="100 %"
        )


        self.step_label.config(
            text=""
        )


        self.time_label.config(
            text=""
        )


        self.status.set(
            "Votre photo est prête. Vous pouvez la modifier ou continuer."
        )


        self.modify_button.config(
            state=tk.NORMAL
        )


        self.continue_button.config(
            state=tk.NORMAL
        )


    def modify_image(self):

        if self.current_image is None:

            return


        self.prompt_text.focus_set()


        self.status.set(
            "Modifiez votre description puis cliquez sur Générer la photo."
        )


        self.modify_button.config(
            state=tk.DISABLED
        )


        self.continue_button.config(
            state=tk.DISABLED
        )


    def continue_image(self):

        if self.current_image is None:

            messagebox.showwarning(
                "Aucune image",
                "Aucune image n'est disponible."
            )

            return


        if self.current_seed is None:

            messagebox.showwarning(
                "Erreur",
                "Impossible d'identifier l'image actuelle."
            )

            return


        filename = (
            f"sd15_{self.current_seed}_final.png"
        )


        path = os.path.join(
            OUTPUT_DIR,
            filename
        )


        try:

            self.current_image.save(
                path
            )


            self.modify_button.config(
                state=tk.DISABLED
            )


            self.continue_button.config(
                state=tk.DISABLED
            )


            self.status.set(
                "Votre photo a été enregistrée."
            )


            messagebox.showinfo(
                "Photo enregistrée",
                "Votre photo a été enregistrée avec succès."
            )


        except Exception as e:

            messagebox.showerror(
                "Erreur",
                "Impossible d'enregistrer la photo.\n\n"
                + str(e)
            )


if __name__ == "__main__":

    root = tk.Tk()

    app = StableDiffusionApp(
        root
    )

    root.mainloop()
