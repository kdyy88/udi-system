"use client";

type PageHeaderProps = {
  title: string;
  description?: string;
  titleClassName?: string;
};

export function PageHeader({ title, description, titleClassName }: PageHeaderProps) {
  return (
    <header>
      <div>
        <h1 className={titleClassName ?? "text-3xl font-bold tracking-tight"}>{title}</h1>
        {description ? (
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </header>
  );
}
