using Microsoft.EntityFrameworkCore;
using DocQR.Api.Entities;

namespace DocQR.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();
    public DbSet<Department> Departments => Set<Department>();
    public DbSet<UserDepartment> UserDepartments => Set<UserDepartment>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Docket> Dockets => Set<Docket>();
    public DbSet<DocketType> DocketTypes => Set<DocketType>();
    public DbSet<DocketAttachment> DocketAttachments => Set<DocketAttachment>();
    public DbSet<DocketComment> DocketComments => Set<DocketComment>();
    public DbSet<DocketAssignment> DocketAssignments => Set<DocketAssignment>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<Register> Registers => Set<Register>();
    public DbSet<RegisterEntry> RegisterEntries => Set<RegisterEntry>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // User indexes
        modelBuilder.Entity<User>()
            .HasIndex(u => u.Email)
            .IsUnique();

        modelBuilder.Entity<User>()
            .HasIndex(u => u.Username)
            .IsUnique();

        // Role indexes
        modelBuilder.Entity<Role>()
            .HasIndex(r => r.Name)
            .IsUnique();

        // Permission indexes
        modelBuilder.Entity<Permission>()
            .HasIndex(p => p.Code)
            .IsUnique();

        // UserRole relationships
        modelBuilder.Entity<UserRole>()
            .HasOne(ur => ur.User)
            .WithMany(u => u.UserRoles)
            .HasForeignKey(ur => ur.UserId);

        modelBuilder.Entity<UserRole>()
            .HasOne(ur => ur.Role)
            .WithMany(r => r.UserRoles)
            .HasForeignKey(ur => ur.RoleId);

        // Department indexes
        modelBuilder.Entity<Department>()
            .HasIndex(d => d.Code)
            .IsUnique();

        modelBuilder.Entity<Department>()
            .HasOne(d => d.Parent)
            .WithMany(d => d.Children)
            .HasForeignKey(d => d.ParentId)
            .OnDelete(DeleteBehavior.Restrict);

        // UserDepartment relationships
        modelBuilder.Entity<UserDepartment>()
            .HasOne(ud => ud.User)
            .WithMany(u => u.UserDepartments)
            .HasForeignKey(ud => ud.UserId);

        modelBuilder.Entity<UserDepartment>()
            .HasOne(ud => ud.Department)
            .WithMany(d => d.UserDepartments)
            .HasForeignKey(ud => ud.DepartmentId);

        // Docket indexes
        modelBuilder.Entity<Docket>()
            .HasIndex(d => d.DocketNumber)
            .IsUnique();

        modelBuilder.Entity<Docket>()
            .HasIndex(d => d.QrToken)
            .IsUnique();

        modelBuilder.Entity<Docket>()
            .HasOne(d => d.Creator)
            .WithMany()
            .HasForeignKey(d => d.CreatedBy)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<Docket>()
            .HasOne(d => d.Updater)
            .WithMany()
            .HasForeignKey(d => d.UpdatedBy)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<Docket>()
            .HasOne(d => d.CurrentAssignee)
            .WithMany()
            .HasForeignKey(d => d.CurrentAssigneeId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<Docket>()
            .HasOne(d => d.Closer)
            .WithMany()
            .HasForeignKey(d => d.ClosedBy)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<Docket>()
            .HasOne(d => d.CurrentDepartment)
            .WithMany()
            .HasForeignKey(d => d.CurrentDepartmentId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<Docket>()
            .HasOne(d => d.DocketType)
            .WithMany(dt => dt.Dockets)
            .HasForeignKey(d => d.DocketTypeId)
            .OnDelete(DeleteBehavior.SetNull);

        // DocketType indexes
        modelBuilder.Entity<DocketType>()
            .HasIndex(dt => dt.Code)
            .IsUnique();

        // DocketAttachment
        modelBuilder.Entity<DocketAttachment>()
            .HasOne(a => a.Docket)
            .WithMany(d => d.Attachments)
            .HasForeignKey(a => a.DocketId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<DocketAttachment>()
            .HasOne(a => a.Uploader)
            .WithMany()
            .HasForeignKey(a => a.UploadedBy)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<DocketAttachment>()
            .HasOne(a => a.LastEditor)
            .WithMany()
            .HasForeignKey(a => a.LastEditedBy)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<DocketAttachment>()
            .HasOne(a => a.Signer)
            .WithMany()
            .HasForeignKey(a => a.SignedBy)
            .OnDelete(DeleteBehavior.SetNull);

        // DocketComment
        modelBuilder.Entity<DocketComment>()
            .HasOne(c => c.Docket)
            .WithMany(d => d.Comments)
            .HasForeignKey(c => c.DocketId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<DocketComment>()
            .HasOne(c => c.Author)
            .WithMany()
            .HasForeignKey(c => c.AuthorId)
            .OnDelete(DeleteBehavior.Cascade);

        // DocketAssignment
        modelBuilder.Entity<DocketAssignment>()
            .HasOne(a => a.Docket)
            .WithMany(d => d.Assignments)
            .HasForeignKey(a => a.DocketId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<DocketAssignment>()
            .HasOne(a => a.AssignedToUser)
            .WithMany()
            .HasForeignKey(a => a.AssignedTo)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<DocketAssignment>()
            .HasOne(a => a.AssignedByUser)
            .WithMany()
            .HasForeignKey(a => a.AssignedFrom)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<DocketAssignment>()
            .HasOne(a => a.AssignedToDepartment)
            .WithMany()
            .HasForeignKey(a => a.AssignedToDepartmentId)
            .OnDelete(DeleteBehavior.SetNull);

        // RefreshToken indexes
        modelBuilder.Entity<RefreshToken>()
            .HasIndex(rt => rt.Token)
            .IsUnique();

        modelBuilder.Entity<RefreshToken>()
            .HasOne(rt => rt.User)
            .WithMany(u => u.RefreshTokens)
            .HasForeignKey(rt => rt.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // Notification
        modelBuilder.Entity<Notification>()
            .HasOne(n => n.User)
            .WithMany()
            .HasForeignKey(n => n.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // AuditLog
        modelBuilder.Entity<AuditLog>()
            .HasOne(a => a.User)
            .WithMany()
            .HasForeignKey(a => a.UserId)
            .OnDelete(DeleteBehavior.SetNull);

        // Configure JSONB columns for PostgreSQL
        modelBuilder.Entity<Role>()
            .Property(r => r.Permissions)
            .HasColumnType("jsonb");

        modelBuilder.Entity<Docket>()
            .Property(d => d.Tags)
            .HasColumnType("jsonb");

        modelBuilder.Entity<Docket>()
            .Property(d => d.CustomFields)
            .HasColumnType("jsonb");

        // Register relationships
        modelBuilder.Entity<Register>()
            .HasIndex(r => r.Code)
            .IsUnique();

        modelBuilder.Entity<Register>()
            .HasOne(r => r.Department)
            .WithMany()
            .HasForeignKey(r => r.DepartmentId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<Register>()
            .HasOne(r => r.Creator)
            .WithMany()
            .HasForeignKey(r => r.CreatedBy)
            .OnDelete(DeleteBehavior.SetNull);

        // RegisterEntry relationships
        modelBuilder.Entity<RegisterEntry>()
            .HasOne(e => e.Register)
            .WithMany(r => r.Entries)
            .HasForeignKey(e => e.RegisterId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<RegisterEntry>()
            .HasOne(e => e.Docket)
            .WithMany()
            .HasForeignKey(e => e.DocketId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<RegisterEntry>()
            .HasOne(e => e.Creator)
            .WithMany()
            .HasForeignKey(e => e.CreatedBy)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
