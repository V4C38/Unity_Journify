import { Behaviour, GameObject, serializable } from "@needle-tools/engine";
import { Journify_Chapter } from "./Journify_Chapter";

export class Journify_UserArchive extends Behaviour {
    // Serialized list of objects (set these in the Unity Editor)
    @serializable(Object)
    public chapterObjects: Object[] = [];

    // The index of the chapter to be visible on begin. Negative = no chapter visible.
    @serializable()
    public selectedChapterIndex: number = -1;

    // Runtime array of Journify_Chapter components
    private chapters: Journify_Chapter[] = [];

    start(): void {
        // Loop through each serialized object, cast to any so we can extract the component
        for (const obj of this.chapterObjects) {
            const chapter = GameObject.getComponent(obj as any, Journify_Chapter);
            if (chapter) {
                this.chapters.push(chapter);
                // Bind the click event so that when a chapter is clicked,
                // the manager can update visibility.
                chapter.onChapterClicked = (clickedChapter: Journify_Chapter) => {
                    this.handleChapterClicked(clickedChapter);
                };
            }
        }

        // On begin, show the selected chapter (if any) and hide all others
        if (this.selectedChapterIndex >= 0 && this.selectedChapterIndex < this.chapters.length) {
            this.chapters.forEach((ch, index) => {
                if (index === this.selectedChapterIndex) {
                    ch.show();
                } else {
                    ch.hide();
                }
            });
        }
    }

    private handleChapterClicked(chapter: Journify_Chapter): void {
        const index = this.chapters.indexOf(chapter);
        if (index === -1) return;

        this.selectedChapterIndex = index;
        // Show the clicked chapter and hide the others
        this.chapters.forEach((ch, i) => {
            if (i === index) {
                ch.show();
            } else {
                ch.hide();
            }
        });
    }
}
