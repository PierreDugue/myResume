import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { SkillPicker } from '../../shared/skill-picker/skill-picker';
import { ResumeEditorStore } from '../resume-editor.store';
import { SaveStatus } from '../save-status';

/** "Edit tech stack" next to an experience or project: every skill, grouped by category. */
@Component({
  selector: 'app-item-skills-form',
  imports: [SkillPicker],
  templateUrl: './skills-form.html',
})
export class ItemSkillsForm implements OnInit {
  readonly kind = input.required<'experience' | 'project'>();
  readonly id = input.required<string>();
  readonly closed = output<void>();

  private readonly store = inject(ResumeEditorStore);
  protected readonly skills = computed(() => this.store.list('skill'));
  protected readonly selected = signal<string[]>([]);
  protected readonly status = new SaveStatus(inject(DestroyRef));

  ngOnInit(): void {
    this.selected.set([...(this.store.find(this.kind(), this.id())?.skillIds ?? [])]);
  }

  protected submit(event: Event): void {
    event.preventDefault();
    const selected = this.selected();
    this.status.run(
      this.store.update(this.kind(), this.id(), () => {
        // A skill deleted before the write's turn is no longer a valid id.
        const known = new Set(this.store.list('skill').map((s) => s.id));
        return { skillIds: selected.filter((id) => known.has(id)) };
      }),
      () => this.closed.emit(),
    );
  }
}
