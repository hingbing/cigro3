import { render, screen } from '@testing-library/react';
import HomePage from '@/app/page';
import { it, expect } from 'vitest';
it('identifies the LoungeFit booking service', () => { render(<HomePage />); expect(screen.getByRole('heading', { name: '라운지핏' })).toBeVisible(); });
