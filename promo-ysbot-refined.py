import bpy, math, os

ROOT = r"C:\Users\yasse\مجلد جديد"
OUT = os.path.join(ROOT, "YS-Bot-Promo")
os.makedirs(OUT, exist_ok=True)
BLEND = os.path.join(OUT, "YS-Bot-Promo-Refined.blend")
VIDEO = os.path.join(OUT, "YS-Bot-Promo-Refined.mp4")
BANNER = os.path.join(ROOT, "ys-bot-banner.png")

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=1280
scene.render.resolution_y=720
scene.render.resolution_percentage=100
scene.render.fps=24
scene.frame_start=1
scene.frame_end=240
scene.render.image_settings.media_type='VIDEO'
scene.render.image_settings.file_format='FFMPEG'
scene.render.image_settings.color_mode='RGB'
scene.render.ffmpeg.format='MPEG4'
scene.render.ffmpeg.codec='H264'
scene.render.ffmpeg.constant_rate_factor='HIGH'
scene.render.filepath=VIDEO
scene.render.film_transparent=False
scene.view_settings.view_transform='AgX'
scene.eevee.taa_render_samples=24

world=bpy.data.worlds.new('YS | Night studio') if not bpy.data.worlds else bpy.data.worlds[0]
scene.world=world
world.use_nodes=True
world.node_tree.nodes['Background'].inputs['Color'].default_value=(0.003,0.009,0.022,1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value=0.2

def emission(name,color,strength=1):
    m=bpy.data.materials.new(name); m.use_nodes=True; m.diffuse_color=(*color,1)
    n=m.node_tree.nodes; n.clear(); e=n.new('ShaderNodeEmission'); e.inputs['Color'].default_value=(*color,1); e.inputs['Strength'].default_value=strength
    o=n.new('ShaderNodeOutputMaterial'); m.node_tree.links.new(e.outputs[0],o.inputs['Surface']); return m

def gradient_material():
    m=bpy.data.materials.new('YS | Midnight teal gradient'); m.use_nodes=True
    n=m.node_tree.nodes; n.clear(); links=m.node_tree.links
    coord=n.new('ShaderNodeTexCoord')
    dist=n.new('ShaderNodeVectorMath'); dist.operation='DISTANCE'; dist.inputs[1].default_value=(0.72,0.60,0.5)
    links.new(coord.outputs['Generated'],dist.inputs[0])
    ramp=n.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].position=0.02; ramp.color_ramp.elements[0].color=(0.012,0.085,0.105,1)
    ramp.color_ramp.elements[1].position=0.72; ramp.color_ramp.elements[1].color=(0.003,0.009,0.020,1)
    e=ramp.color_ramp.elements.new(0.28); e.color=(0.009,0.031,0.060,1)
    links.new(dist.outputs['Value'],ramp.inputs['Fac'])
    em=n.new('ShaderNodeEmission'); em.inputs['Strength'].default_value=0.9; links.new(ramp.outputs['Color'],em.inputs['Color'])
    out=n.new('ShaderNodeOutputMaterial'); links.new(em.outputs[0],out.inputs['Surface'])
    return m

MINT=emission('YS | Mint signal',(0.18,0.98,0.80),1.25)
BLUE=emission('YS | Cobalt signal',(0.22,0.60,1.0),1.1)
WHITE=emission('YS | Pearl type',(0.88,0.95,1.0),1.0)
SOFT=emission('YS | Quiet type',(0.43,0.59,0.69),0.82)
BACK=gradient_material()

def make_camera():
    bpy.ops.object.camera_add(location=(0,0,22)); c=bpy.context.object; c.name='YS | Campaign camera'; c.data.type='ORTHO'; c.data.ortho_scale=18; scene.camera=c; return c
cam=make_camera()

# Full-bleed night background, no decorative frame around the supplied identity art.
bpy.ops.mesh.primitive_plane_add(size=1, location=(0,0,-4))
bg=bpy.context.object; bg.name='YS | Full-bleed midnight gradient'; bg.dimensions=(20,12,1); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); bg.data.materials.append(BACK)

try:
    bold=bpy.data.fonts.load(r'C:\Windows\Fonts\arialbd.ttf')
    regular=bpy.data.fonts.load(r'C:\Windows\Fonts\arial.ttf')
except: bold=regular=None

def add_text(name,body,loc,size,material,font,align='CENTER'):
    d=bpy.data.curves.new(name,'FONT'); d.body=body; d.size=size; d.align_x=align; d.align_y='CENTER'; d.extrude=0.0015; d.bevel_depth=0.0005
    if font:
        try:d.font=font
        except:pass
    o=bpy.data.objects.new(name,d); scene.collection.objects.link(o); o.location=loc; d.materials.append(material); return o

def animate_scale(obj,keys):
    for frame,scale in keys:
        obj.scale=(scale,scale,scale); obj.keyframe_insert(data_path='scale',frame=frame)

def animate_y(obj,keys):
    for frame,y in keys:
        obj.location.y=y; obj.keyframe_insert(data_path='location',frame=frame)

def thin_line(name,coords,material,width=0.012):
    c=bpy.data.curves.new(name,'CURVE'); c.dimensions='3D'; c.bevel_depth=width; c.bevel_resolution=3
    s=c.splines.new('POLY'); s.points.add(len(coords)-1)
    for p,(x,y,z) in zip(s.points,coords):p.co=(x,y,z,1)
    o=bpy.data.objects.new(name,c); scene.collection.objects.link(o); c.materials.append(material); return o

# Slow, restrained camera push, then settle; keeps the logo clear and cinematic.
for f,scale in [(1,18.6),(45,18.0),(155,17.6),(210,18.0),(240,18.0)]:
    cam.data.ortho_scale=scale; cam.data.keyframe_insert(data_path='ortho_scale',frame=f)

# Official YS banner enters cleanly, without a thick surrounding box.
img=bpy.data.images.load(BANNER,check_existing=True); img.pack()
mat=bpy.data.materials.new('YS | Official banner with alpha'); mat.use_nodes=True; mat.surface_render_method='DITHERED'
n=mat.node_tree.nodes; n.clear(); tex=n.new('ShaderNodeTexImage'); tex.image=img; tex.interpolation='Linear'
em=n.new('ShaderNodeEmission'); em.inputs['Strength'].default_value=0.93
tr=n.new('ShaderNodeBsdfTransparent'); mix=n.new('ShaderNodeMixShader'); out=n.new('ShaderNodeOutputMaterial')
mat.node_tree.links.new(tex.outputs['Color'],em.inputs['Color']); mat.node_tree.links.new(tex.outputs['Alpha'],mix.inputs[0]); mat.node_tree.links.new(tr.outputs[0],mix.inputs[1]); mat.node_tree.links.new(em.outputs[0],mix.inputs[2]); mat.node_tree.links.new(mix.outputs[0],out.inputs['Surface'])
w,h=img.size; aspect=w/max(h,1); pw=16.35; ph=pw/aspect
bpy.ops.mesh.primitive_plane_add(size=1,location=(0,0.43,0.2)); banner=bpy.context.object; banner.name='YS | Official identity banner'; banner.dimensions=(pw,ph,1); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); banner.data.materials.append(mat)
uv=banner.data.uv_layers.active
for poly in banner.data.polygons:
    for li in poly.loop_indices:
        v=banner.data.vertices[banner.data.loops[li].vertex_index].co
        # Crop the transparent rounded corners baked into the source banner.
        uv.data[li].uv=(0.025+(v.x/pw+0.5)*0.95,0.025+(v.y/ph+0.5)*0.95)
animate_scale(banner,[(1,0.92),(32,1.0),(145,1.0),(184,0.82),(240,0.82)])

# Minimal label and thin accent trace: quiet typography rather than feature cards.
eyebrow=add_text('YS | Eyebrow','DISCORD SECURITY  /  YS-BOT',(0,4.34,0.38),0.235,SOFT,bold)
animate_scale(eyebrow,[(1,0.001),(22,1.0),(160,1.0),(176,0.001)])
features=add_text('YS | Product line','PROTECTION     /     MODERATION     /     COMMUNITY',(0,-3.38,0.38),0.235,WHITE,bold)
animate_scale(features,[(1,0.001),(54,0.001),(72,1.0),(158,1.0),(174,0.001)])
caption=add_text('YS | Campaign line','Built to make your Discord easier to manage.',(0,-3.84,0.38),0.245,SOFT,regular)
animate_scale(caption,[(1,0.001),(76,0.001),(92,1.0),(158,1.0),(174,0.001)])

# Fine mint rule grows from the center and retracts as the closing lockup arrives.
rule=thin_line('YS | Motion rule',[(-7.9,-2.85,0.28),(7.9,-2.85,0.28)],MINT,0.010)
for f,scale in [(1,0.001),(62,0.001),(80,1.0),(156,1.0),(173,0.001)]:
    rule.scale.x=scale; rule.keyframe_insert(data_path='scale',frame=f)

close_group=bpy.data.objects.new('YS | Closing lockup',None); scene.collection.objects.link(close_group)
close_group.empty_display_type='PLAIN_AXES'; close_group.location=(0,0,0)
closing=add_text('YS | Closing headline','Protect your community.',(0,-3.05,0.42),0.46,WHITE,bold)
url=add_text('YS | Website','ys-bot.vercel.app',(0,-3.82,0.42),0.35,MINT,bold)
cta=add_text('YS | Add bot call-to-action','ADD YS-BOT TO YOUR SERVER',(0,-4.35,0.42),0.19,SOFT,bold)
for obj in (closing,url,cta):obj.parent=close_group
animate_scale(close_group,[(1,0.001),(166,0.001),(184,1.0),(230,1.0),(240,1.0)])

# A pair of hairline traces frame the scene edges and drift gently in opposite directions.
for i,side in enumerate((-1,1)):
    x=side*8.45
    trace=thin_line(f'YS | Edge trace {i+1}',[(x,-2.15,-0.1),(x,1.6,-0.1),(x-side*0.22,1.86,-0.1)],BLUE if i else MINT,0.012)
    trace.location.x=side*0.22; trace.keyframe_insert(data_path='location',frame=1); trace.location.x=0; trace.keyframe_insert(data_path='location',frame=120); trace.location.x=-side*0.22; trace.keyframe_insert(data_path='location',frame=240)

scene.frame_set(100)
for o in bpy.context.selected_objects:o.select_set(False)
bpy.ops.wm.save_as_mainfile(filepath=BLEND)
print('Saved refined editable Blender project:',BLEND)
if os.environ.get('YS_PREVIEW_ONLY')!='1':
    print('Rendering refined promo:',VIDEO)
    bpy.ops.render.render(animation=True)
    print('Finished:',VIDEO)
