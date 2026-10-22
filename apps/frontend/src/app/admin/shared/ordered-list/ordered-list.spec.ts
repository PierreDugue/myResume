import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { $ } from '../../../testing';
import { OrderedItem, OrderedList } from './ordered-list';

describe('OrderedList', () => {
  const items: OrderedItem[] = [
    { id: 'a', title: 'KX', subtitle: 'Sep 2022 – Nov 2025', link: '/admin/experiences/a' },
    { id: 'b', title: 'Winning Group', link: '/admin/experiences/b' },
    { id: 'c', title: 'Isentia', link: '/admin/experiences/c' },
  ];

  async function render(list = items) {
    TestBed.configureTestingModule({ imports: [OrderedList], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(OrderedList);
    fixture.componentRef.setInput('items', list);
    fixture.componentRef.setInput('label', 'Experiences');
    const reordered = vi.fn();
    const deleted = vi.fn();
    fixture.componentInstance.reordered.subscribe(reordered);
    fixture.componentInstance.deleted.subscribe(deleted);
    await fixture.whenStable();
    return { el: fixture.nativeElement as HTMLElement, reordered, deleted };
  }

  afterEach(() => vi.restoreAllMocks());

  it('lists items in order, each title linking to its edit page', async () => {
    const { el } = await render();
    const links = [...el.querySelectorAll<HTMLAnchorElement>('li a.title')];
    expect(links.map((a) => a.textContent?.trim())).toEqual(['KX', 'Winning Group', 'Isentia']);
    expect(links[0].getAttribute('href')).toBe('/admin/experiences/a');
    expect(el.textContent).toContain('Sep 2022 – Nov 2025');
  });

  it('has a labelled list and accessible buttons', async () => {
    const { el } = await render();
    expect($(el, 'ol').getAttribute('aria-label')).toBe('Experiences');
    expect($(el, 'li:nth-child(2) button.move-up').getAttribute('aria-label')).toBe(
      'Move "Winning Group" up',
    );
  });

  it('emits the new order when an item moves up or down', async () => {
    const { el, reordered } = await render();
    $<HTMLButtonElement>(el, 'li:nth-child(2) button.move-up').click();
    expect(reordered).toHaveBeenLastCalledWith(['b', 'a', 'c']);
    $<HTMLButtonElement>(el, 'li:nth-child(2) button.move-down').click();
    expect(reordered).toHaveBeenLastCalledWith(['a', 'c', 'b']);
  });

  it('disables "up" on the first item and "down" on the last', async () => {
    const { el } = await render();
    expect($<HTMLButtonElement>(el, 'li:first-child button.move-up').disabled).toBe(true);
    expect($<HTMLButtonElement>(el, 'li:last-child button.move-down').disabled).toBe(true);
  });

  it('asks for confirmation before deleting', async () => {
    const confirm = vi
      .spyOn(window, 'confirm')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    const { el, deleted } = await render();
    const button = $<HTMLButtonElement>(el, 'li:nth-child(3) button.delete');
    button.click();
    expect(deleted).not.toHaveBeenCalled();
    button.click();
    expect(confirm).toHaveBeenLastCalledWith('Delete "Isentia"?');
    expect(deleted).toHaveBeenCalledWith('c');
  });

  it('shows an empty state', async () => {
    const { el } = await render([]);
    expect(el.textContent).toContain('Nothing here yet');
  });
});
